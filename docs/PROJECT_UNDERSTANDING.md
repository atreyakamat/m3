# Project understanding

## Sources inspected

I inspected the empty repository (one Markdown copy of PRD v0.3 and no existing app, environment, tests, or database), its Git history, and the supplied Word documents in `/home/atreya/Downloads`: `Project proposal on mobile app based malaria_surveillance(V6).docx`, `m3platform.docx`, and `M3_Malaria_Surveillance_PRD_v0.3.docx`. `Work-To-be-Done.txt` was not present in the repository, Downloads, or accessible home workspace and was therefore not used.

The proposal establishes the research context: malaria surveillance of migrant construction labourers in Goa, initially around 15,000 workers in four areas, with migration/travel, symptoms, temperature, malaria history, RDT/microscopy species data, and molecular work. It supports research fields such as PCR, parasite density, gametocytes, resistance markers, and pfhrp2/pfhrp3. It is not a clinical protocol or proof of performance at that scale.

`m3platform.docx` describes the prior Android 11+ Kotlin/Compose app: phone-based entry, six stakeholder workflows, opaque patient ID, interruption-safe forms, and private CSV storage. It also describes collecting Aadhaar/GPS in the old concept. Those fields are deliberately excluded from this prototype because PRD v0.3 and the confirmed prompt supersede them.

## Product goal and implementation priority

M3 is an authorized mobile and office-LAN web platform for privacy-conscious surveillance coordination, not a diagnostic or treatment engine. This build supplies a clean PostgreSQL schema, FastAPI service, synthetic fixtures, role-enforced workflows, a browser console, and an Expo Go-compatible mobile app with a read-only authorized cache.

Priority order was: safe identity and authorization; linked worker/site/clinical/pathology/follow-up/research records; reliable synthetic startup; then dashboards and operational web views. No legacy data is imported.

## Existing-code assessment and gaps

There was no existing implementation to preserve. The source documents have two material conflicts: earlier PRD sections prescribe offline writes/outbox and propose extra admin roles, while v0.3 and the prompt require offline viewing only and exactly six stakeholder roles. The implementation follows v0.3. Source documents name treatment, follow-up timing, consent wording, export policy, final role scopes, and clinical field mandatory rules but do not approve them; this build records data rather than prescribing those rules.
