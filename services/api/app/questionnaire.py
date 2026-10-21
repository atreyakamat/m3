"""Versioned screening questionnaire schema (PRD v1.0, five sections).

Storage shape: {"personal": {...}, "past_history": {...}, "present_clinical":
{...}, "migration_history": {...}, "planned_travel": {...}}.  Values are stored
as stable answer codes; display labels live in the client.  "Don't know", "not
sure" and "not required" are distinct stored values.  Clinical thresholds and
escalation rules are deliberately NOT implemented here (PRD DEC-13).
"""

SCHEMA_VERSION = 1
SECTIONS = ("personal", "past_history", "present_clinical", "migration_history", "planned_travel")

YES_NO = ("yes", "no")
YES_NO_UNSURE = ("yes", "no", "dont_know")
YES_NO_NOT_SURE = ("yes", "no", "not_sure")
YES_NO_NOT_REQUIRED = ("yes", "no", "not_required")

TREATMENT_PLACES = ("uhc_phc", "private_clinic", "govt_hospital", "pharmacy", "other")

DATE_RE = r"^\d{4}-\d{2}-\d{2}$"

def _is_date(value):
    import re
    if not isinstance(value, str) or not re.fullmatch(DATE_RE, value):
        return False
    year, month, day = (int(part) for part in value.split("-"))
    import datetime
    try:
        datetime.date(year, month, day)
    except ValueError:
        return False
    return True

def _phone_shape_ok(raw):
    """Loose format check; one global format is not assumed (PRD §5 page 1)."""
    if not isinstance(raw, str):
        return False
    compact = raw.strip().replace(" ", "").replace("-", "")
    if not compact.startswith("+"):
        compact = "+91" + compact if compact.isdigit() else compact
    digits = compact.lstrip("+")
    return digits.isdigit() and 8 <= len(digits) <= 15

def _to_int(value):
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def _err(path, message):
    return {"path": path, "message": message}

def _choice(field_value, allowed, path, errors, label):
    if field_value not in allowed:
        errors.append(_err(path, f"{label} must be one of: {', '.join(allowed)}"))

def _choice_required(getter, key, allowed, path, errors, label):
    value = getter(key)
    if value is None or value == "":
        errors.append(_err(path, f"{label} is required"))
    else:
        _choice(value, allowed, path, errors, label)

def _date_field(value, path, errors, label, required=False):
    if value in (None, ""):
        if required:
            errors.append(_err(path, f"{label} is required"))
        return
    if not _is_date(value):
        errors.append(_err(path, f"{label} must be a valid date (YYYY-MM-DD)"))

def _validate_personal(section, errors):
    get = lambda k: section.get(k)
    name = get("full_name")
    if not isinstance(name, str) or len(name.strip()) < 2 or len(name.strip()) > 120:
        errors.append(_err("personal.full_name", "Full name is required (2-120 chars)"))
    if get("dob") in (None, "") and get("age_years") in (None, ""):
        errors.append(_err("personal.dob", "Date of birth or completed age is required"))
    if get("dob") not in (None, ""):
        _date_field(get("dob"), "personal.dob", errors, "Date of birth")
        if get("age_years") not in (None, ""):
            errors.append(_err("personal.age_years", "Age conflicts with DOB; provide completed age only or confirm both"))
    if get("age_years") not in (None, ""):
        age = _to_int(get("age_years"))
        if age is None or age < 0 or age > 120:
            errors.append(_err("personal.age_years", "Completed age must be 0-120 years"))
    _choice_required(get, "gender", ("male", "female"), "personal.gender", errors, "Gender")
    mobile = get("mobile")
    if not mobile:
        errors.append(_err("personal.mobile", "Mobile number is required"))
    elif not _phone_shape_ok(mobile):
        errors.append(_err("personal.mobile", "Mobile number format is invalid"))
    if get("alternate_contact") and len(str(get("alternate_contact"))) > 120:
        errors.append(_err("personal.alternate_contact", "Alternate contact is too long"))
    _choice_required(get, "id_type", ("aadhaar", "voter_id", "other"), "personal.id_type", errors, "ID type")
    if get("id_type") == "other" and not str(get("id_other_details") or "").strip():
        errors.append(_err("personal.id_other_details", "Details are required for Other ID type"))
    addr = get("address_present")
    if not isinstance(addr, str) or len(addr.strip()) < 4 or len(addr.strip()) > 400:
        errors.append(_err("personal.address_present", "Present address is required"))
    if get("address_permanent") and len(str(get("address_permanent"))) > 400:
        errors.append(_err("personal.address_permanent", "Permanent address is too long"))
    _choice_required(get, "preferred_language", ("hindi", "english", "bengali", "other"), "personal.preferred_language", errors, "Preferred language")

def _validate_past_history(section, errors):
    get = lambda k: section.get(k)
    diagnosed = get("diagnosed_malaria")
    _choice_required(get, "diagnosed_malaria", YES_NO_UNSURE, "past_history.diagnosed_malaria", errors, "Diagnosed malaria")
    if diagnosed != "yes":
        return
    times = _to_int(get("times_malaria_2y"))
    if times is None or times < 0 or times > 50:
        errors.append(_err("past_history.times_malaria_2y", "Number of malaria episodes in last 2 years is required (0-50)"))
    _choice_required(get, "last_detection", ("less_1_year", "1_2_years", "dont_know"), "past_history.last_detection", errors, "Last detection")
    _choice_required(get, "treatment_place", TREATMENT_PLACES, "past_history.treatment_place", errors, "Treatment place")
    if get("treatment_place") == "other" and not str(get("treatment_place_other") or "").strip():
        errors.append(_err("past_history.treatment_place_other", "Details are required for Other treatment place"))
    _choice_required(get, "diagnostic_test_performed", YES_NO, "past_history.diagnostic_test_performed", errors, "Diagnostic test performed")
    if get("diagnostic_test_performed") != "yes":
        return
    _choice_required(get, "same_day_report", YES_NO, "past_history.same_day_report", errors, "Same-day report")
    if get("same_day_report") != "yes":
        return
    _choice_required(get, "test_method", ("rdt", "microscopy", "not_sure"), "past_history.test_method", errors, "Test method")
    _choice_required(get, "medication_period", ("days_3", "days_14", "followup_28", "not_informed", "dont_know"), "past_history.medication_period", errors, "Medication period")
    if get("medication_period") in ("days_3", "days_14", "followup_28"):
        _choice_required(get, "full_course_completed", YES_NO_NOT_SURE, "past_history.full_course_completed", errors, "Full course completed")

def _validate_present_clinical(section, errors):
    get = lambda k: section.get(k)
    fever = get("fever_today")
    _choice_required(get, "fever_today", YES_NO_NOT_SURE, "present_clinical.fever_today", errors, "Fever today")
    temp = get("temperature_c")
    if temp not in (None, ""):
        try:
            t = float(temp)
        except (TypeError, ValueError):
            t = None
        if t is None or t < 30.0 or t > 45.0:
            errors.append(_err("present_clinical.temperature_c", "Temperature must be 30.0-45.0 °C"))
    if fever in ("yes", "not_sure"):
        value = get("fever_duration")
        if value not in ("within_24h", "1_3_days", "more_3_days", "not_required"):
            errors.append(_err("present_clinical.fever_duration", "Fever duration is required"))
    symptoms = get("symptoms") if isinstance(get("symptoms"), list) else []
    SPECIFIC = ("chills_shivering", "headache", "sweating", "body_ache", "nausea_vomiting", "weakness_fatigue")
    if "no_other_symptoms" in symptoms and any(s in SPECIFIC for s in symptoms):
        errors.append(_err("present_clinical.symptoms", "'No other symptoms' cannot be combined with specific symptoms"))
    unknown = [s for s in symptoms if s not in SPECIFIC + ("no_other_symptoms",)]
    if unknown:
        errors.append(_err("present_clinical.symptoms", f"Unknown symptom code: {sorted(unknown)[0]}"))
    if any(s in SPECIFIC for s in symptoms):
        _date_field(get("onset_date"), "present_clinical.onset_date", errors, "Symptom onset date", required=True)
    for key, label in (("breathing_difficulty", "Breathing difficulty"), ("chest_pain", "Chest pain"), ("confusion", "Confusion")):
        _choice_required(get, key, YES_NO, f"present_clinical.{key}", errors, label)
    _choice_required(get, "can_attend_testing", YES_NO_NOT_REQUIRED, "present_clinical.can_attend_testing", errors, "Can attend testing today")

def _validate_migration_history(section, errors):
    get = lambda k: section.get(k)
    _choice_required(get, "time_in_goa", ("up_to_1_month", "1_6_months", "6_months_or_more"), "migration_history.time_in_goa", errors, "Time in Goa")
    outside = get("outside_goa_3m")
    _choice_required(get, "outside_goa_3m", YES_NO, "migration_history.outside_goa_3m", errors, "Outside Goa in last 3 months")
    if outside == "yes":
        states = get("states_visited") if isinstance(get("states_visited"), list) else []
        clean = [s for s in states if isinstance(s, str) and s.strip()]
        if not clean:
            errors.append(_err("migration_history.states_visited", "States visited are required"))
        elif len(clean) > 20:
            errors.append(_err("migration_history.states_visited", "Too many states listed"))
        if get("last_stay_home_state") not in ("7_days", "14_days", "up_to_1_month"):
            errors.append(_err("migration_history.last_stay_home_state", "Last stay in home state is required"))
    _choice_required(get, "fever_before_goa_3m", YES_NO_UNSURE, "migration_history.fever_before_goa_3m", errors, "Fever/malaria 3 months before coming to Goa")

def _validate_planned_travel(section, errors):
    get = lambda k: section.get(k)
    planning = get("planning")
    _choice_required(get, "planning", YES_NO, "planned_travel.planning", errors, "Planning to travel")
    episodes = get("episodes") if isinstance(get("episodes"), list) else []
    if planning == "no":
        return
    if not episodes:
        errors.append(_err("planned_travel.episodes", "At least one travel episode is required when planning to travel"))
        return
    if len(episodes) > 10:
        errors.append(_err("planned_travel.episodes", "Too many travel episodes"))
        return
    for index, episode in enumerate(episodes):
        base = f"planned_travel.episodes.{index}"
        episode_get = lambda k: episode.get(k)
        _date_field(episode_get("departure_date"), f"{base}.departure_date", errors, "Departure date", required=True)
        _date_field(episode_get("return_date"), f"{base}.return_date", errors, "Return date", required=True)
        departure, return_date = episode_get("departure_date"), episode_get("return_date")
        if _is_date(str(departure)) and _is_date(str(return_date)) and str(return_date) < str(departure):
            errors.append(_err(f"{base}.return_date", "Return date cannot precede departure date"))
        if not str(episode_get("place_state") or "").strip():
            errors.append(_err(f"{base}.place_state", "Place/state is required"))
        fever = episode_get("fever_malaria_during")
        _choice(fever, YES_NO, f"{base}.fever_malaria_during", errors, "Fever/malaria during travel")
        if fever is None or fever == "":
            errors.append(_err(f"{base}.fever_malaria_during", "Fever/malaria during travel is required"))
        if fever == "yes":
            treatment = episode_get("treatment_given")
            _choice_required(episode_get, "treatment_given", YES_NO, f"{base}.treatment_given", errors, "Treatment given")
            if treatment == "yes":
                _choice_required(episode_get, "full_course_completed", YES_NO_NOT_SURE, f"{base}.full_course_completed", errors, "Full course completed")
                _choice_required(episode_get, "treatment_place", TREATMENT_PLACES, f"{base}.treatment_place", errors, "Treatment place")
                if episode_get("treatment_place") == "other" and not str(episode_get("treatment_place_other") or "").strip():
                    errors.append(_err(f"{base}.treatment_place_other", "Details are required for Other treatment place"))

_VALIDATORS = {
    "personal": _validate_personal,
    "past_history": _validate_past_history,
    "present_clinical": _validate_present_clinical,
    "migration_history": _validate_migration_history,
    "planned_travel": _validate_planned_travel,
}

def validate(data, sections=None):
    """Validate staged questionnaire data. Returns sorted [{path, message}]."""
    if not isinstance(data, dict):
        return [_err("data", "Questionnaire data must be an object")]
    errors = []
    for section_key in SECTIONS:
        if sections and section_key not in sections:
            continue
        section = data.get(section_key)
        _VALIDATORS[section_key](section if isinstance(section, dict) else {}, errors)
    return sorted(errors, key=lambda item: item["path"])

def has_any_answer(data):
    if not isinstance(data, dict):
        return False
    return any(node not in (None, {}) for node in data.values())
