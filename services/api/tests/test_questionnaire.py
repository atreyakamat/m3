"""Unit tests for the questionnaire schema module (PRD sections 1-5, SCR/REG rules)."""
import pytest
from app import questionnaire


def section(key):
    return {key: {}}


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
    assert not any(
        e["path"] == "personal.dob"
        for e in questionnaire.validate({"personal": {"dob": "1999-01-01", "age_years": 26}})
    )
    assert any(
        e["path"] == "personal.age_years"
        for e in questionnaire.validate({"personal": {"dob": "1999-01-01", "age_years": 26}})
    )
    assert not any(
        e["path"].startswith("personal.age_years")
        for e in questionnaire.validate({"personal": {"age_years": 30}})
    )


def test_reg003_dob_is_a_real_date():
    assert any(e["path"] == "personal.dob" for e in questionnaire.validate({"personal": {"dob": "1999-02-30"}}))


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
    keys = {"symptoms": ["headache"], "onset_date": "2026-10-01",
            "breathing_difficulty": "no", "chest_pain": "no", "confusion": "no",
            "can_attend_testing": "yes", "fever_today": "yes", "fever_duration": "1_3_days"}
    clean = questionnaire.validate({"present_clinical": keys})
    assert not [e for e in clean if e["path"] == "present_clinical.symptoms"]


def test_onset_date_required_when_specific_symptom_selected():
    data = {"present_clinical": {"symptoms": ["headache"], "fever_today": "yes",
                                 "fever_duration": "1_3_days"}}
    assert any(e["path"] == "present_clinical.onset_date" for e in questionnaire.validate(data))


def test_s004_travel_return_cannot_precede_departure():
    base = lambda dep, ret: {
        "planning": "yes",
        "episodes": [{"departure_date": dep, "return_date": ret, "place_state": "WB",
                      "fever_malaria_during": "no"}]}
    errors = questionnaire.validate({"planned_travel": base("2026-11-01", "2026-10-01")})
    assert any(e["path"] == "planned_travel.episodes.0.return_date" for e in errors)
    assert not any(e["path"].startswith("planned_travel.episodes.0")
                   for e in questionnaire.validate({"planned_travel": base("2026-10-01", "2026-11-01")}))


def test_travel_episode_conditional_chain():
    def run(ep):
        return {e["path"] for e in questionnaire.validate({"planned_travel": {"planning": "yes", "episodes": [ep]}})}
    fever_episode = {"departure_date": "2026-11-01", "return_date": "2026-11-10",
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
