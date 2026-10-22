"""Unit tests for the questionnaire schema module (PRD sections 1-5, SCR/REG rules)."""
from datetime import date, timedelta
import pytest
from app import questionnaire


def section(key):
    return {key: {}}


def iso(days_from_today):
    """ISO date days_from_today days after the current local date (negative = past).

    Date-boundary tests must be computed at runtime so they never become stale
    hard-coded dates."""
    return (date.today() + timedelta(days=days_from_today)).isoformat()


def test_empty_data_reports_required_errors_per_section():
    errors = questionnaire.validate({section: {} for section in questionnaire.SECTIONS})
    paths = {e["path"] for e in errors}
    assert "personal.full_name" in paths
    assert "personal.dob" in paths
    assert "past_history.diagnosed_malaria" in paths
    assert "present_clinical.fever_today" in paths
    assert "migration_history.time_in_goa" in paths
    assert "planned_travel.planning" in paths


def test_reg003_dob_or_age_required_and_mismatch_flagged():
    assert any(e["path"] == "personal.dob" for e in questionnaire.validate({"personal": {}}))
    # dob + auto-calculated age that MATCHES completed years is accepted.
    dob = iso(-30 * 365 + 3)
    matching_age = questionnaire.age_in_completed_years(dob)
    consistent = {"dob": dob, "age_years": matching_age}
    assert not [
        e for e in questionnaire.validate({"personal": consistent})
        if e["path"] in ("personal.dob", "personal.age_years")
    ]
    # Mismatched age is rejected (path stays stable for existing clients).
    assert any(
        e["path"] == "personal.age_years"
        for e in questionnaire.validate({"personal": {"dob": dob, "age_years": matching_age + 1}})
    )
    assert not any(
        e["path"].startswith("personal.age_years")
        for e in questionnaire.validate({"personal": {"age_years": 30}})
    )


def test_reg003_dob_is_a_real_date():
    assert any(e["path"] == "personal.dob" for e in questionnaire.validate({"personal": {"dob": "1999-02-30"}}))


def test_dob_boundaries_90_years_and_no_future():
    min_dob, max_dob = questionnaire.dob_boundaries()
    # Boundary itself is selectable (exactly 90 calendar years ago) when dob
    # and the auto-calculated age agree.
    consistent = {
        "personal": {
            "full_name": "R Kumar", "gender": "male", "mobile": "+919000000001",
            "id_type": "aadhaar", "address_present": "Some Address Goa",
            "preferred_language": "hindi", "dob": min_dob,
            "age_years": questionnaire.DOBPAST_YEARS,
        }
    }
    boundary_errors = [e for e in questionnaire.validate(consistent)
                       if e["path"] in ("personal.dob", "personal.age_years")]
    assert not boundary_errors, boundary_errors
    # One calendar day earlier than the minimum must be rejected...
    older = (date.fromisoformat(min_dob) - timedelta(days=1)).isoformat()
    errors = questionnaire.validate({"personal": {"dob": older}})
    assert any(e["path"] == "personal.dob" and "90 years" in e["message"] for e in errors)
    # ...and one day after today (future) must be rejected.
    future = (date.today() + timedelta(days=1)).isoformat()
    errors = questionnaire.validate({"personal": {"dob": future}})
    assert any(e["path"] == "personal.dob" and "future" in e["message"] for e in errors)


def test_dob_leap_day_handling():
    # 2024-02-29 is a real leap day and a valid historic DOB (before the
    # 90-year horizon; only the future rule would reject it, and it is past).
    errors = questionnaire.validate({"personal": {"dob": "2024-02-29"}})
    assert not any(e["path"] == "personal.dob" for e in errors)
    # add_calendar_years clamps Feb 29 -> Feb 28 in a non-leap target year.
    assert questionnaire.add_calendar_years(date(2024, 2, 29), 1) == date(2025, 2, 28)
    assert questionnaire.add_calendar_years(date(2024, 2, 29), -90) == date(1934, 2, 28)
    # Impossible calendar dates are never silently accepted.
    assert not questionnaire._is_date("2100-02-29")
    assert not questionnaire._is_date("2025-02-29")


def test_age_in_completed_years_semantics():
    q = questionnaire
    # Birthday today/already passed -> elapsed years.
    assert q.age_in_completed_years("2000-03-01", date(2026, 3, 1)) == 26
    assert q.age_in_completed_years("2000-03-01", date(2026, 2, 28)) == 25
    # Leap-day DOB: before Feb 28 in a non-leap year the birthday has not occurred.
    assert q.age_in_completed_years("2024-02-29", date(2025, 2, 27)) == 0
    assert q.age_in_completed_years("2024-02-29", date(2025, 3, 1)) == 1


def test_reg004_other_id_requires_details():
    assert any(
        e["path"] == "personal.id_other_details"
        for e in questionnaire.validate({"personal": {"id_type": "other"}})
    )
    assert not any(
        e["path"] == "personal.id_other_details"
        for e in questionnaire.validate({"personal": {"id_type": "aadhaar"}})
    )


def test_s003_no_other_symptoms_mutually_exclusive():
    data = {"present_clinical": {"symptoms": ["no_other_symptoms", "headache"]}}
    assert any(e["path"] == "present_clinical.symptoms" for e in questionnaire.validate(data))
    keys = {"symptoms": ["headache"], "onset_date": iso(-3),
            "breathing_difficulty": "no", "chest_pain": "no", "confusion": "no",
            "can_attend_testing": "yes", "fever_today": "yes", "fever_duration": "1_3_days"}
    clean = questionnaire.validate({"present_clinical": keys})
    assert not [e for e in clean
                if e["path"] in ("present_clinical.symptoms", "present_clinical.onset_date")]


def test_onset_date_required_when_specific_symptom_selected():
    data = {"present_clinical": {"symptoms": ["headache"], "fever_today": "yes",
                                 "fever_duration": "1_3_days"}}
    assert any(e["path"] == "present_clinical.onset_date" for e in questionnaire.validate(data))


def test_onset_date_required_when_fever_reported():
    data = {"present_clinical": {"symptoms": ["no_other_symptoms"], "fever_today": "yes",
                                 "fever_duration": "1_3_days"}}
    assert any(e["path"] == "present_clinical.onset_date" for e in questionnaire.validate(data))
    ok = {"present_clinical": dict(data["present_clinical"], onset_date=iso(-2))}
    assert not any(e["path"] == "present_clinical.onset_date"
                   for e in questionnaire.validate(ok))


def test_onset_date_cannot_be_in_the_future():
    data = {"present_clinical": {"symptoms": ["headache"], "onset_date": iso(2),
                                 "fever_today": "yes", "fever_duration": "1_3_days"}}
    errors = questionnaire.validate(data)
    assert any(e["path"] == "present_clinical.onset_date" and "future" in e["message"]
               for e in errors)
    # Today is acceptable: a past-event field's last legal value.
    ok = {"present_clinical": dict(data["present_clinical"], onset_date=iso(0))}
    assert not any(e["path"] == "present_clinical.onset_date"
                   for e in questionnaire.validate(ok))


def test_past_history_new_source_fields_optional_and_validated():
    required_only = {"past_history": {"diagnosed_malaria": "no"}}
    # Missing optional add-ons must NOT create errors.
    base_errors = questionnaire.validate(required_only, sections=("past_history",))
    assert not [e for e in base_errors if e["path"].startswith("past_history.") and
                any(k in e["path"] for k in ("repellent", "mosquito_net", "mobile_brand", "qualification"))]
    bad = {"past_history": {"diagnosed_malaria": "no", "repellent_use": "sometimes",
                            "mosquito_net_use": "maybe", "mobile_brand": "x" * 61,
                            "qualification": "q" * 121}}
    paths = {e["path"] for e in questionnaire.validate(bad, sections=("past_history",))}
    assert {"past_history.repellent_use", "past_history.mosquito_net_use",
            "past_history.mobile_brand", "past_history.qualification"} <= paths
    with_values = {"past_history": {"diagnosed_malaria": "no", "repellent_use": "yes",
                                    "mosquito_net_use": "no", "mobile_brand": "Samsung",
                                    "qualification": "Class 10"}}
    assert not questionnaire.validate(with_values, sections=("past_history",))


def test_s004_travel_return_cannot_precede_departure():
    dep_from_today = (date.today() + timedelta(days=30)).isoformat()
    earlier = (date.today() + timedelta(days=10)).isoformat()
    base = lambda dep, ret: {
        "planning": "yes",
        "episodes": [{"departure_date": dep, "return_date": ret, "place_state": "WB",
                      "fever_malaria_during": "no"}]}
    errors = questionnaire.validate({"planned_travel": base(dep_from_today, earlier)})
    assert any(e["path"] == "planned_travel.episodes.0.return_date" for e in errors)
    good = {"planned_travel": base(dep_from_today,
                                   (date.today() + timedelta(days=40)).isoformat())}
    assert not any(e["path"].startswith("planned_travel.episodes.0")
                   for e in questionnaire.validate(good))


def test_planned_departure_cannot_be_in_the_past():
    base = lambda days: {"planning": "yes",
                         "episodes": [{"departure_date": iso(days),
                                       "return_date": iso(days + 5),
                                       "place_state": "WB",
                                       "fever_malaria_during": "no"}]}
    errors = questionnaire.validate({"planned_travel": base(-30)})
    assert any(e["path"] == "planned_travel.episodes.0.departure_date"
               and "past" in e["message"] for e in errors)
    assert not any(e["path"].startswith("planned_travel.episodes.0")
                   for e in questionnaire.validate({"planned_travel": base(0)}))


def test_travel_episode_conditional_chain():
    def run(ep):
        return {e["path"] for e in questionnaire.validate({"planned_travel": {"planning": "yes", "episodes": [ep]}})}
    fever_episode = {"departure_date": iso(30), "return_date": iso(40),
                     "place_state": "WB", "fever_malaria_during": "yes"}
    assert "planned_travel.episodes.0.treatment_given" in run(fever_episode)
    treated = dict(fever_episode, treatment_given="yes")
    assert "planned_travel.episodes.0.full_course_completed" in run(treated)
    assert "planned_travel.episodes.0.treatment_place" in run(treated)
    complete = dict(treated, full_course_completed="yes", treatment_place="uhc_phc")
    assert "planned_travel.episodes.0.full_course_completed" not in run(complete)
    other_place = dict(complete, treatment_place="other")
    assert "planned_travel.episodes.0.treatment_place_other" in run(other_place)


def test_past_history_conditional_chain():
    def run(data):
        return {e["path"] for e in questionnaire.validate({"past_history": data}, sections=("past_history",))}
    assert {"past_history.diagnosed_malaria"} <= run({})
    yes_base = {"diagnosed_malaria": "yes"}
    assert {"past_history.times_malaria_2y", "past_history.last_detection",
            "past_history.treatment_place", "past_history.diagnostic_test_performed"} <= run(yes_base)
    tested = dict(yes_base, times_malaria_2y="2", last_detection="less_1_year",
                  treatment_place="uhc_phc", diagnostic_test_performed="yes")
    assert {"past_history.same_day_report"} <= run(tested)
    sameday = dict(tested, same_day_report="yes")
    assert {"past_history.test_method", "past_history.medication_period"} <= run(sameday)
    medicated = dict(sameday, test_method="rdt", medication_period="days_14")
    assert {"past_history.full_course_completed"} <= run(medicated)
    done = dict(medicated, full_course_completed="yes")
    assert not run(done)


def test_section_2_not_diagnosed_short_circuits():
    errors = questionnaire.validate({"past_history": {"diagnosed_malaria": "dont_know"}}, sections=("past_history",))
    assert all(e["path"] == "past_history.diagnosed_malaria" for e in errors)


def test_migration_history_conditionals():
    def run(data):
        return {e["path"] for e in questionnaire.validate({"migration_history": data}, sections=("migration_history",))}
    base = {"time_in_goa": "1_6_months", "outside_goa_3m": "yes",
            "fever_before_goa_3m": "no"}
    assert {"migration_history.states_visited", "migration_history.last_stay_home_state"} <= run(base)
    complete = dict(base, states_visited=["WB"], last_stay_home_state="7_days")
    assert not run(complete)


def test_personal_required_fields_gate_on_all_empty():
    assert {"personal.full_name", "personal.gender", "personal.mobile",
            "personal.id_type", "personal.address_present",
            "personal.preferred_language"} <= {
        e["path"] for e in questionnaire.validate({"personal": {}})}


def test_validate_skip_sections_for_partial_draft_saving():
    errors = questionnaire.validate({"personal": {}}, sections=("personal",))
    assert all(e["path"].startswith("personal.") for e in errors)


def test_invalid_temperature_range():
    errors = questionnaire.validate({"present_clinical": {"temperature_c": 25}})
    assert any(e["path"] == "present_clinical.temperature_c" for e in errors)
