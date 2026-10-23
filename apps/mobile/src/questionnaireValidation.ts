/**
 * Worker questionnaire section validation — extracted verbatim from
 * app/intake.tsx so the SAME conditional rules run in the UI, in the offline
 * demo flow and in automated tests (single source of truth).
 *
 * Pure functions only: no React, no RN, no network, no storage.
 */
import {
  validateDobISO,
  validatePastEventDate,
  validatePlannedTravelDates,
} from './dateFields'

export interface TravelEpisodeState {
  departure_date: string
  return_date: string
  place_state: string
  fever_malaria_during: 'yes' | 'no' | ''
  treatment_given?: 'yes' | 'no' | ''
  full_course_completed?: 'yes' | 'no' | 'not_sure' | ''
  treatment_place?: string
  treatment_place_other?: string
}

export interface QuestionnaireFormData {
  personal: {
    full_name: string
    dob: string
    dob_unknown: 'yes' | 'no' // local fallback when the worker does not know DOB
    age_years: string // manual fallback age (only when dob_unknown === 'yes')
    gender: 'male' | 'female' | ''
    mobile: string
    alternate_contact: string
    id_type: 'aadhaar' | 'voter_id' | 'other' | ''
    id_other_details: string
    address_present: string
    address_permanent: string
    preferred_language: 'hindi' | 'english' | 'bengali' | 'other' | ''
    site_id?: string
  }
  past_history: {
    diagnosed_malaria: 'yes' | 'no' | 'dont_know' | ''
    times_malaria_2y: string
    last_detection: 'less_1_year' | '1_2_years' | 'dont_know' | ''
    treatment_place: 'uhc_phc' | 'private_clinic' | 'govt_hospital' | 'pharmacy' | 'other' | ''
    treatment_place_other: string
    diagnostic_test_performed: 'yes' | 'no' | ''
    same_day_report: 'yes' | 'no' | ''
    test_method: 'rdt' | 'microscopy' | 'not_sure' | ''
    medication_period: 'days_3' | 'days_14' | 'followup_28' | 'not_informed' | 'dont_know' | ''
    full_course_completed: 'yes' | 'no' | 'not_sure' | ''
    // Source questionnaire page 2, recorded alongside Section II.
    repellent_use: 'yes' | 'no' | ''
    mosquito_net_use: 'yes' | 'no' | ''
    mobile_brand: string
    qualification: string
  }
  present_clinical: {
    fever_today: 'yes' | 'no' | 'not_sure' | ''
    temperature_c: string
    fever_duration: 'within_24h' | '1_3_days' | 'more_3_days' | 'not_required' | ''
    symptoms: string[]
    onset_date: string
    breathing_difficulty: 'yes' | 'no' | ''
    chest_pain: 'yes' | 'no' | ''
    confusion: 'yes' | 'no' | ''
    can_attend_testing: 'yes' | 'no' | 'not_required' | ''
  }
  migration_history: {
    time_in_goa: 'up_to_1_month' | '1_6_months' | '6_months_or_more' | ''
    outside_goa_3m: 'yes' | 'no' | ''
    states_visited: string
    last_stay_home_state: '7_days' | '14_days' | 'up_to_1_month' | ''
    fever_before_goa_3m: 'yes' | 'no' | 'dont_know' | ''
  }
  planned_travel: {
    planning: 'yes' | 'no' | ''
    episodes: TravelEpisodeState[]
  }
}

// Build the error map for one section WITHOUT committing it to state.
// (Validation rules are the source questionnaire's conditional requirements.)
export function computeQuestionnaireSectionErrors(
  formData: QuestionnaireFormData,
  sec: number
): Record<string, string> {
  const errs: Record<string, string> = {}

  if (sec === 1) {
    const p = formData.personal
    if (!p.full_name || p.full_name.trim().length < 2) {
      errs['personal.full_name'] = 'Full name is required (min 2 characters)'
    }
    if (p.dob_unknown === 'yes') {
      // Fallback: the worker does not know their DOB — manual age only.
      const a = parseInt(p.age_years, 10)
      if (isNaN(a) || a < 0 || a > 120) {
        errs['personal.age_years'] = 'Completed age must be between 0 and 120'
      }
    } else {
      const dobErr = validateDobISO(p.dob)
      if (!p.dob) {
        errs['personal.dob'] = 'Date of birth is required (tap the field to pick it)'
      } else if (dobErr) {
        errs['personal.dob'] = dobErr
      }
    }
    if (!p.mobile || p.mobile.replace(/\D/g, '').length < 8) {
      errs['personal.mobile'] = 'A valid mobile number is required (min 8 digits)'
    }
    if (p.id_type === 'other' && !p.id_other_details.trim()) {
      errs['personal.id_other_details'] = 'Details are required when Other ID is selected'
    }
    if (!p.address_present || p.address_present.trim().length < 4) {
      errs['personal.address_present'] = 'Present address is required (min 4 characters)'
    }
  }

  if (sec === 2) {
    const h = formData.past_history
    if (!h.diagnosed_malaria) {
      errs['past_history.diagnosed_malaria'] = 'Please select malaria diagnosis status'
    }
    if (h.diagnosed_malaria === 'yes') {
      const times = parseInt(h.times_malaria_2y, 10)
      if (isNaN(times) || times < 0 || times > 50) {
        errs['past_history.times_malaria_2y'] = 'Enter malaria episodes in last 2 years (0-50)'
      }
      if (!h.last_detection) {
        errs['past_history.last_detection'] = 'Please select timing of last detection'
      }
      if (!h.treatment_place) {
        errs['past_history.treatment_place'] = 'Please select treatment location'
      }
      if (h.treatment_place === 'other' && !h.treatment_place_other.trim()) {
        errs['past_history.treatment_place_other'] = 'Specify other treatment place'
      }
      if (!h.diagnostic_test_performed) {
        errs['past_history.diagnostic_test_performed'] = 'Specify if diagnostic test was performed'
      }
      if (h.diagnostic_test_performed === 'yes') {
        if (!h.same_day_report) {
          errs['past_history.same_day_report'] = 'Specify if same-day report was received'
        }
        if (h.same_day_report === 'yes') {
          if (!h.test_method) {
            errs['past_history.test_method'] = 'Select test method'
          }
          if (!h.medication_period) {
            errs['past_history.medication_period'] = 'Select medication period'
          }
          if (
            ['days_3', 'days_14', 'followup_28'].includes(h.medication_period) &&
            !h.full_course_completed
          ) {
            errs['past_history.full_course_completed'] = 'Specify if full course was completed'
          }
        }
      }
    }
  }

  if (sec === 3) {
    const c = formData.present_clinical
    if (!c.fever_today) {
      errs['present_clinical.fever_today'] = 'Specify current fever status'
    }
    const hasSpecific = c.symptoms.some((s) => s !== 'no_other_symptoms')
    if (['yes', 'not_sure'].includes(c.fever_today) && !c.fever_duration) {
      errs['present_clinical.fever_duration'] = 'Fever duration is required'
    }
    if (c.temperature_c) {
      const t = parseFloat(c.temperature_c)
      if (isNaN(t) || t < 30.0 || t > 45.0) {
        errs['present_clinical.temperature_c'] = 'Temperature must be between 30.0 and 45.0 °C'
      }
    }
    // Onset of the current illness: required with fever or specific
    // symptoms, never in the future (past-event field).
    const needsOnset = c.fever_today === 'yes' || hasSpecific
    if (needsOnset && !c.onset_date) {
      errs['present_clinical.onset_date'] = 'Onset date of the current illness is required'
    } else if (c.onset_date) {
      const onsetErr = validatePastEventDate(c.onset_date, 'Onset date')
      if (onsetErr) errs['present_clinical.onset_date'] = onsetErr
    }
    if (!c.breathing_difficulty) {
      errs['present_clinical.breathing_difficulty'] = 'Required'
    }
    if (!c.chest_pain) {
      errs['present_clinical.chest_pain'] = 'Required'
    }
    if (!c.confusion) {
      errs['present_clinical.confusion'] = 'Required'
    }
    if (!c.can_attend_testing) {
      errs['present_clinical.can_attend_testing'] = 'Required'
    }
  }

  if (sec === 4) {
    const m = formData.migration_history
    if (!m.time_in_goa) {
      errs['migration_history.time_in_goa'] = 'Select duration lived in Goa'
    }
    if (!m.outside_goa_3m) {
      errs['migration_history.outside_goa_3m'] = 'Specify travel outside Goa in last 3 months'
    }
    if (m.outside_goa_3m === 'yes') {
      if (!m.states_visited.trim()) {
        errs['migration_history.states_visited'] = 'Specify states visited outside Goa'
      }
      if (!m.last_stay_home_state) {
        errs['migration_history.last_stay_home_state'] = 'Select duration of stay in home state'
      }
    }
    if (!m.fever_before_goa_3m) {
      errs['migration_history.fever_before_goa_3m'] = 'Specify prior fever/malaria history'
    }
  }

  if (sec === 5) {
    const t = formData.planned_travel
    if (!t.planning) {
      errs['planned_travel.planning'] = 'Specify if travel is planned'
    }
    if (t.planning === 'yes') {
      if (t.episodes.length === 0) {
        errs['planned_travel.episodes'] = 'Add at least one travel episode'
      }
      t.episodes.forEach((ep, idx) => {
        const dateErrs = validatePlannedTravelDates(ep.departure_date, ep.return_date)
        if (!ep.departure_date) {
          errs[`episode.${idx}.departure_date`] = 'Departure date is required (tap the field to pick it)'
        } else if (dateErrs.departure) {
          errs[`episode.${idx}.departure_date`] = dateErrs.departure
        }
        if (!ep.return_date) {
          errs[`episode.${idx}.return_date`] = 'Return date is required (tap the field to pick it)'
        } else if (dateErrs.return) {
          errs[`episode.${idx}.return_date`] = dateErrs.return
        }
        if (!ep.place_state.trim()) {
          errs[`episode.${idx}.place_state`] = 'Destination place/state required'
        }
        if (!ep.fever_malaria_during) {
          errs[`episode.${idx}.fever_malaria_during`] = 'Specify fever during travel'
        }
        if (ep.fever_malaria_during === 'yes') {
          if (!ep.treatment_given) {
            errs[`episode.${idx}.treatment_given`] = 'Specify if treatment was given'
          }
          if (ep.treatment_given === 'yes') {
            if (!ep.full_course_completed) {
              errs[`episode.${idx}.full_course_completed`] = 'Course completion required'
            }
            if (!ep.treatment_place) {
              errs[`episode.${idx}.treatment_place`] = 'Treatment place required'
            }
            if (ep.treatment_place === 'other' && !ep.treatment_place_other?.trim()) {
              errs[`episode.${idx}.treatment_place_other`] = 'Details required for Other place'
            }
          }
        }
      })
    }
  }

  return errs
}
