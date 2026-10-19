# Decisions and unresolved items

## Decisions applied

| Topic | Decision |
| --- | --- |
| Roles | Exactly worker, clinician, pathology, health worker, research lab, contractor. `technical_provisioner` is a guarded technical capability, not a seventh stakeholder role. |
| Offline | Read-only SQLite cache after a successful authorized sync. No write queue, draft submission, or fake local success. Logout implementation removes token; cache clearing policy is documented as a production blocker. |
| Sensitive identifiers | No Aadhaar, continuous GPS, SMS, attachments, raw phone in patient records, or QR integration. |
| Follow-up | Due date is supplied by an authorized user/configuration; no Day 3/Day 7 clinical schedule is hard-coded. |
| Diagnosis/treatment | Structured result status/species and documented treatment text only. No inference, prescribing, treatment advice, or closure rule. |
| Account setup | Header-protected bootstrap secret provisions first synthetic users. It never ships a universal production PIN. |

## Proposed conservative permission matrix

| Role | View | Create/update | Export |
| --- | --- | --- | --- |
| Worker | Own profile/cache only | Own intake only when online | No |
| Clinician | Authorized worker and clinical record | Clinical assessment | No |
| Pathology | Minimum patient/sample context | RDT/microscopy sample and result | No |
| Health worker | Assigned follow-ups | Assigned follow-up records | No |
| Research lab | Linked sample/research context | Molecular result | No |
| Contractor | Scoped roster/site aggregate only | Site metadata and permitted roster association | No |

The API enforces the role gates; contractor detailed clinical/research access is blocked. Current facility/district scope is an intentional conservative prototype gap: role assignment has `scope_type/scope_id`; contractor site scope is enforced when populated. All final scope rules need an approved matrix before pilot acceptance.

## Production blockers

Clinical field dictionary, protocols, mandatory fields, treatment documentation policy, follow-up schedules, and closure rules; consent/assent and retention/deletion policy; verified staff onboarding/PIN reset/offboarding; reviewed Hindi clinical translation; cache-expiry/encryption/lost-device policy; formal LAN host/firewall/TLS security; backup encryption and restore drill; monitoring/incident plan; signed APK key custody; performance/security tests at intended scale.
