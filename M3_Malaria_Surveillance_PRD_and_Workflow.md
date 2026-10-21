_PRODUCT REQUIREMENTS & WORKFLOW SPECIFICATION_ 

# M3 Malaria Surveillance Platform 

Version 1.0 • Requirements baseline for stakeholder review 

Purpose: define the connected mobile and desktop workflows for migrant labour-worker malaria surveillance, including registration, screening, contractor site management, clinical assessment, pathology, follow-up, research access, and administration. Confirmed requirements are separated from decisions requiring approval. 

## **1. Executive summary** 

The platform uses a shared database and a common Worker/Patient ID to connect a worker profile with contractor/site membership, screening questionnaires, clinician assessments, pathology results, travel history, and follow-up. Mobile is optimized for workers and field use; desktop supports the same role-controlled records. QR codes locate/link a worker record but do not replace authentication or authorization. 

- The seven initial roles are Labour Worker, Contractor, Pathologist, Clinician/Medical Officer, Health Worker, Research Lab, and Admin. 

- Research Lab, Health Worker, and Admin are read-only for the initial release as requested; future permissions must be configurable. 

- Contractors can create/manage their construction site and add/link workers by search or QR, subject to authorization and an agreed consent policy. 

- The worker questionnaire has five sections: Personal Details; Past History of Malaria; Present Clinical Details; Migration and Travel History; Travel in and outside Goa. 

- Questionnaire content below is based on the supplied questions. Clinical thresholds, unspecified meanings, and unclear field rules are flagged rather than invented. 

## **2. Goals, non-goals, success criteria** 

### **Goals** 

- Create one connected worker record that authorized roles can find using a stable Worker/Patient ID. 

- Capture supplied questionnaires with pagination, conditional questions, validation, save/resume, and review-beforesubmit. 

- Support registration, contractor site membership, screening, clinical assessment, diagnostic results, admission/discharge, travel, and follow-up linkage. 

- Support responsive mobile and desktop interfaces with role-specific navigation. 

- Use test-driven development: tests define expected behavior before implementation and run for every change. 

- Enforce access controls server-side, with auditable and configurable role permissions. 

### **Non-goals / safety boundaries** 

- No automated diagnosis, treatment recommendation, or clinical triage decision unless separately approved and governed. 

- A QR code alone must never grant access to personal or clinical data. 

- Research Lab, Health Worker, and Admin cannot create/update/delete records in the initial release. 

- Do not collect a full government ID number unless explicitly approved; the supplied questionnaire asks for ID type, not necessarily ID number. 

|**Area**|**Acceptance criterion**|
|---|---|
|Registration|Valid required details create one worker profile with a stable unique<br>Worker ID.<br>i|
|Record linking|Authorized users find the correct worker and link records without<br>duplicateprofiles.|
|Questionnaires|All supplied questions are represented; conditions are honored;<br>Back/Nextpreserves answers.|
|Role access|API tests prove allowed/denied access for each role; read-only roles<br>cannot mutate data.|
|Contractor|Contractor manages only authorized sites and permitted worker/site<br>links.|
|Diagnostics|Test method, result/species, smear type, and follow-up slide status<br>are recorded.|
|Clinical|Assessment and admission/discharge fields are conditional and<br>linked to the worker.|
|Reliability|Errors are recoverable; there is no silent data loss; duplicate<br>submissions are handled.|
|Platforms|Core workflows work on mobile and desktop through the same<br>backend rules.|



## **3. Roles and access model** 

|**Role**|**Initial capabilities**<br>i|**Restrictions / notes**|
|---|---|---|
|Labour Worker|Create/view own profile; complete own<br>questionnaire; view permitted personal<br>status/follow-up.|Cannot view another worker. Cannot edit<br>finalized clinical/lab results.|
|Contractor|Create/manage authorized site; view site<br>roster; add/link workers by QR/search; record<br>travel details andpermitted status.|Only own/assigned sites and minimum<br>necessary data; no unrestricted<br>clinical/research data.|
|Pathologist|Find worker; enter RDT/SMP/other tests,<br>results/species, smear type, follow-up slide<br>receipt and reason.|Cannot edit demographics or clinician<br>records unless separately authorized.|
|Clinician / Medical Officer|Find worker; enter assessment, symptoms,<br>comorbidities, treatment,<br>admission/discharge,follow-upassignment.|Cannot overwrite pathology result; clinical<br>decisions remain with qualified<br>professionals.|
|Health Worker|Read-only access to assigned follow-up<br>details/status.|No create/update/delete in initial release.<br>i|
|Research Lab|Read-only access to approved research<br>dataset/fields.|Least-privilege; exclude direct identifiers<br>unless explicitlyapproved.|
|Admin|Read-only view of approved operational<br>records and status.|Read-only initially; confirm this is intentional<br>beforeproduction.|



Enforce permissions in the backend/API for every operation and record, not only by hiding UI controls. Use record-level scope checks (own worker, assigned site, assigned follow-up, approved research scope). 

## **4. Core data entities and relationships** 

|**Entity**|**Purpose / relationships**|
|---|---|
|User Account|Authentication identity, role, active status; distinct from worker<br>profile.|
|Worker Profile|Stable Worker ID; identity/contact/demographic details, language,<br>malaria history, protectionpractices,travel history.<br>i|
|Contractor|Contractorprofile and authorized sites.|
|Construction Site|Site name, district, area, address/facility references as approved;<br>linked to contractor.<br>f|
|Site Membership|Worker ID ↔ Site ID with status/effective dates; supports site changes<br>without duplicateprofiles.|
|Screening Questionnaire|Versioned responses, completion state, timestamps, respondent,<br>Worker ID.|
|Clinical Assessment|Vitals, symptoms, general condition, comorbidities, treatment,<br>admission/discharge/outcome,Worker ID.|



|Laboratory Investigation|Test type, RDT/microscopy/SMP results, species, smear type,<br>pathologist/facility,Worker ID.|
|---|---|
|Follow-up Task/Slide|Assigned health worker, scheduled day/date, receipt, positivity,<br>missingreason,Worker ID/lab record.|
|Travel Episode|Outside-Goa departure/return, destinations, illness/treatment<br>answers,Worker ID.|
|Audit Event|Actor,action,record type/ID,timestamp,outcome;never logsecrets.|



Use opaque internal IDs plus a human-friendly Worker ID. Mobile number is searchable but not the primary key because it may change or be shared. 

## **5. Worker registration and screening workflow** 

1. Open app → Register/Sign in. Separate account authentication from clinical questionnaire responses. 

2. Create Worker Profile and generate a unique Worker ID. QR encodes only an opaque reference/token, never name, mobile number, diagnosis, or other personal data. 

3. Complete five paginated sections with progress, Save Draft, Back, Continue, and Review & Submit. 

4. Save after each step where supported; show saved/unsaved status and restore draft after navigation/restart. 

5. Review all answers before submission. Corrections after submission use a versioned amendment/correction path rather than silently overwriting history. 

6. Show confirmation with Worker ID and next steps; do not generate a diagnosis or treatment recommendation automatically. 

|**Page**|**Fields /questions**|**Validation / conditional behavior**|
|---|---|---|
|1. Personal details|Full name as per ID; DOB; age in completed<br>years; gender Male/Female; mobile; optional<br>alternate contact; ID type Aadhaar/Voter<br>ID/Other; present address;<br>permanent/home-town address; preferred<br>language Hindi/English/Bengali/Other.|DOB is a date; derive completed age from<br>DOB and reference date; flag mismatch if age<br>is also entered. Validate mobile format<br>without assuming one global format. Other<br>requires details. Government ID number is<br>not collected unless approved.|
|2. Past malaria history|Diagnosed malaria Yes/No/Don't know;<br>number of times in last 2 years; last detection<br>category ≤1 year / 1–2 years / don't know;<br>treatment place UHC/PHC, private clinic,<br>Govt Hospital, pharmacy, other; diagnostic<br>test performed Yes/No; same-day report<br>Yes/No and method RDT/microscopy/not<br>sure; medication/treatment period 3 days, 14<br>days (P. vivax), 28 days follow-up, not<br>informed/don't know; full course completed<br>Yes/No/Not sure; mobile brand; qualification;<br>repellent Yes/No;mosquito net Yes/No.|Show count and detailed history when<br>relevant. Confirm “Mobile Brand” (assumed<br>phone brand) and “Qualification” (assumed<br>education). Preserve supplied treatment<br>choices pending clinical review.|
|3. Present clinical details|Fever today Yes/No/Not sure; measured<br>temperature if known; duration 24 hours / 1–3<br>days / >3 days / not required; symptoms<br>chills/shivering, headache, sweating, body<br>ache, nausea/vomiting, weakness/fatigue, no<br>other symptoms; onset date; breathing<br>difficulty/chest pain/confusion Yes/No; can<br>attend testingtodayYes/No/Not required.|Temperature numeric with unit; strict range<br>requires clinical approval. “No other<br>symptoms” mutually exclusive with symptom<br>selections. Red-flag answers show approved<br>urgent-assessment instructions only after a<br>protocol is supplied.|
|4. Migration/travel history|Time in Goa ≤1 month / 1–6 months / ≥6<br>months; outside Goa in last 3 months<br>Yes/No; states visited; last stay in home state<br>7 days / 14 days / ≤1 month; fever/malaria in 3<br>months before coming to Goa Yes/No/Don't<br>know.|Show dependent fields only when applicable.<br>Duration options may overlap or leave gaps;<br>clarify before strict validation.|
|5. Planned travel outside Goa|Planning to travel Yes/No; departure date;<br>return date; place/state; fever/malaria during<br>travel Yes/No; treatment given Yes/No; full<br>course completed Yes/No; treatment place.|Show travel details only if Yes. Return cannot<br>precede departure. Treatment questions<br>show only when fever/malaria is Yes;<br>course/place only when treatment is Yes.<br>Confirm repeatable travel episodes.|



### **Questionnaire versioning** 

Every submission retains questionnaire/schema version. Historical submissions remain interpretable after questions change. Store structured answer codes and display labels; keep Don't know, Not sure, and Not required as distinct values. 

## **6. Pathology workflow** 

7. Pathologist signs in and searches by Worker/Patient ID or mobile (permitted lookup); confirm identity using minimum necessary details. 

8. Select facility from managed dropdown; address options are filtered by facility. Pathologist identity comes from authenticated account or approved directory. 

9. Create lab investigation linked to Worker ID; demographics are displayed from the profile, not duplicated. 

10. Record test done: RDT, SMP, Other. Record RDT Negative/Positive and applicable species (P. falciparum, P. vivax, mixed Pf+Pv, Other). 

11. Record microscopy Negative/Positive and applicable species; record smear type Thick/Thin/Both. 

12. Record scheduled follow-up slides received Yes/No. If Yes, record whether any follow-up slide was positive and which day. If No, require a reason: patient unavailable/missed visit; left Goa/migrated; refused; slide broken/spoiled; not collected by worker; other. 

13. Review and submit; corrections to finalized results are auditable amendments. 

|**Fieldgroup**|**Validation**|
|---|---|
|Facility/address|Facilityrequired;address options correspond to facility.|
|Test/result|Require result onlyfor tests actually performed.|
|Species|Show/require where applicable; Other requires description.<br>Standardize labels after lab-owner review.|
|Smear type|Required when microscopy/smearperformed.|
|Follow-upslides|If not received,reason required;ifpositive,follow-updayrequired.|
|Worker link|Must reference existing Worker ID; lab form cannot implicitly create a<br>worker.|



Open terminology: “SMP” needs confirmation from the lab owner; do not assume its meaning. 

## **7. Clinician workflow** 

14. Clinician signs in and searches Worker/Patient ID or mobile; demographics are linked to the worker profile. 

15. Select Medical Officer and facility type from approved list initially supplied: UHC Panji, PHC Candolim, UHC Margao, PHC Cortalim. Address depends on selected facility. 

16. Record temperature °C; fever duration <24 hours, 1–3 days, 4–7 days, >7 days; symptoms chills/rigors, sweating, headache, nausea/vomiting, abdominal pain, joint/body aches, weakness/fatigue, other; general condition Stable/Moderately ill/Severe; blood pressure; comorbidities Diabetes, Hypertension, None, Other; treatment prescribed. 

17. Record admitted Yes/No. If Yes, show admission details: species/diagnosis, admission symptoms, severity Mild/Severe malaria, treatment completion status, reason if incomplete, discharge/transfer date, outcome, remarks. 

18. If not admitted, record Treatment Given Yes/No and Health Worker assigned for follow-up Yes/No. If assigned, create/link a valid follow-up task. 

19. Review and submit; retain clinician identity, timestamps, and assessment history. 

|**Validation**|**Expected behavior**|
|---|---|
|Temperature/BP|Numeric structured values with units; clinical bounds/warnings<br>require approved clinical rules.|
|Symptoms/comorbidities|Multi-select; None mutually exclusive with other comorbidities; Other<br>requires description.<br>i|
|Admission branch|Admission-onlyfields appear onlywhen admitted=Yes.|
|Incomplete treatment|Reason required when treatment is not completed;discharge/transfer|



date required where applicable. Follow-up Assigned=Yes only when a valid assignment/task exists. 

## **8. Contractor and site workflow** 

20. Contractor signs in and creates/selects a construction site with site name, district, area and approved address options. 

21. Contractor views only authorized site roster and permitted basic worker/site status. 

22. Add worker by scanning QR or searching Worker ID/mobile. Show minimal confirmation to prevent wrong-person linking. 

23. Create Site Membership linking Worker ID and Site ID; never create duplicate worker profiles. Confirm whether worker consent/confirmation is required. 

24. Record contractor-reported malaria diagnosis status Pv/Pf/Pv-Pf/Other and treatment status treated/untreated only within approved permissions. Do not overwrite authoritative clinician/pathology data. 

25. Choose worker from authorized roster and record departure from Goa and return date; validate dates and retain multiple travel episodes. 

|**Field**|**Validation / decision**|
|---|---|
|Contractor/site|Site must be owned/assigned to authenticated contractor.|
|District/area|Managed dropdowns;dependent area options where appropriate.<br>i|
|QR/search|QR has no sensitive data;authorization required;confirm identity.<br>i|
|Diagnosis/treatment|Distinguish contractor-reported status from verified clinical/lab<br>status.|
|Travel dates|Return cannotprecede departure;support multiple episodes.|



## **9. Read-only workflows: Health Worker, Research Lab, Admin** 

- Health Worker: view only assigned follow-up records and minimum information needed; no create/update/delete. 

- Research Lab: view only approved research fields/datasets; prefer de-identified/pseudonymized data; direct identifiers require explicit approval. 

- Admin: read-only view of authorized operational records/status in initial release; no mutations. 

- Future permissions remain configurable in one policy layer. Any role change requires explicit approval, updated tests, and audit review. 

## **10. Shared search, QR and record-linking rules** 

- Worker ID is stable; screening, clinical, lab, site-membership, and travel records reference it. 

- Search supports exact Worker ID and authorized mobile lookup. Ambiguous matches require user confirmation. 

- QR contains only an opaque identifier/token. Scanning never bypasses authentication, permissions, site scope, or audit logging. 

- Duplicate detection can suggest candidates but must not auto-merge based on name/mobile alone. 

- Log sensitive record access/change appropriately; never log passwords, tokens, or unnecessary health data. 

## **11. Pagination and UI standards** 

- Role-specific dashboard and navigation; backend permissions remain authoritative. 

- Long forms use logical pages, progress indicator, section name, Save Draft, Back, Continue, Review & Submit. 

- Back preserves answers. Continue validates the current page and focuses the first invalid field. 

- Inline errors and page-level summary; one invalid field must not clear valid answers. 

- Drafts are visibly incomplete and cannot be mistaken for submitted records. 

- 

- 

- 

- Review/submit summarizes answers and requires explicit confirmation. 

- Prevent double submission; show loading, success and failure states. 

- Accessible labels, touch targets, keyboard-aware layout, date pickers, and language-ready strings. 

## **12. Error handling and integrity** 

|**Failure**|**Required behavior**<br>f|
|---|---|
|Network unavailable|Keep safe draft locally if supported; show offline status; never claim<br>server submission succeeded;retrysafely.<br>i|
|API validation error|Mapserver errors to fields and retain entered answers.|
|Session expired|Prompt re-authentication; protect recoverable draft; prevent cross-<br>account cached data exposure.|
|Forbidden access|Show access-denied message without leaking restricted record<br>details.|
|Double submit/retry|Idempotent create semantics or duplicateprevention.<br>l|
|Stale/conflicting edits|Detect conflict and ask user to reload/reconcile; never silently<br>overwrite.|
|InvalidQR|Explain failure and offer authorized manual lookup.|
|Unexpected server error|Show non-sensitive message/reference ID; protected logs capture<br>technical details.|
|Invalid reference IDs|Reject forged/unknown facility, site, role, or worker references server-<br>side.|



## **13. TDD strategy** 

Use Red → Green → Refactor. Write a failing test before implementation, confirm it fails for the expected reason, implement the smallest passing change, refactor, and rerun regressions. Compilation alone is not evidence of workflow correctness. 

26. Agree requirements and acceptance criteria; mark unresolved decisions as blockers for affected validations. 

27. Write domain/schema tests and API tests for IDs, relationships, conditional fields, permissions, and invalid inputs. 

28. Run and observe expected test failure (Red). 

29. Implement schema/API/service/UI behavior (Green). 

30. Refactor while keeping tests green. 

31. Run regression tests across mobile/desktop and all roles. 

32. Record exact commands, environment, counts, failures, and manual tests in TESTING.md. 

## **14. Initial test catalogue** 

|**Test ID**|**Scenario**|**Expected result**|**Level**|
|---|---|---|---|
|REG-001|Valid registration<br>i|One profile and stable Worker ID<br>created.<br>i|API/integration|
|REG-002|Required field missing|Field error;nopartialprofile.<br>l|API/UI|
|REG-003|DOB/age|Completed age derived; conflict<br>flagged.|Unit/UI|
|REG-004|Other option|Description required where<br>applicable.<br>l|Unit/UI|
|REG-005|Duplicate candidate|Candidate flagged; no auto-<br>merge.|Integration|
|REG-006|Unique ID under concurrency|No duplicate Worker IDs.|DB/integration|
|SCR-001|Pagination|Back/Nextpreserves answers.|UI|
|SCR-002|Conditional fields|Dependent fields show only<br>when applicable.|UI|
|SCR-003|No other symptoms|Mutually exclusive with specific<br>symptoms.|Unit/UI|
|SCR-004|Travel dates|Return before departure<br>rejected.|Unit/API|
|SCR-005|Draft recovery|Draft restores and remains|Integration/device|



|||incomplete.||
|---|---|---|---|
|SCR-006|Double submit|Onlyone submission created.|API/integration|
|PATH-001|Worker linking|Lab result references existing<br>Worker ID.|API/integration|
|PATH-002|Test not performed|Result not required for<br>unperformed test.|Unit/API|
|PATH-003|Positive/species|Applicable species or Other<br>description required.|Unit/UI|
|PATH-004|Slide not received|Reason required.|Unit/API|
|PATH-005|Positive follow-up|Follow-updayrequired.<br>i|Unit/API|
|CLIN-001|Admission conditional|Admission fields only for<br>admitted=Yes.|UI/API|
|CLIN-002|Incomplete treatment|Reason required.|UI/API|
|CLIN-003|Follow-up assignment|Yes requires valid linked<br>assignment.|Integration|
|CONT-001|Site isolation|Contractor cannot access<br>another contractor's site.|API security|
|CONT-002|QR safety|Valid token resolves permitted<br>record; invalid rejected; no PII in<br>QR.|Integration|
|CONT-003|Travel record|Linked travel episode and valid<br>date order.|API/integration|
|AUTH-001|Role matrix|Only explicitly allowed actions<br>succeed.|API security|
|AUTH-002|Health Worker read-only|Mutation attempts rejected.|API security|
|AUTH-003|Research Lab read-only|Mutations rejected; approved<br>fields only.|API security|
|AUTH-004|Admin read-only|i<br>Mutations rejected initially.|API security|
|AUTH-005|Unauthenticated request|401 without record leakage.|API security|
|DATA-001|Mobile changes|Worker ID and history remain<br>stable.|Integration|
|DATA-002|Audit trail|Actor/time recorded; secrets<br>excluded.|Integration|
|DATA-003|Offline cache isolation|Prior user's cached records<br>hidden after account switch.|Device/integration|
|DATA-004|Stale edit|Conflict detected, not<br>overwritten.|API/integration|
|E2E-001|Worker-to-lab|Register → screen → linked lab<br>result.|E2E|
|E2E-002|Worker-to-clinician|Search ID → assessment →<br>conditional admission flow.|E2E|
|E2E-003|Contractor onboarding|l<br>Create site → QR/search worker →<br>membership→ travel.|E2E|
|E2E-004|Read-only roles|Read approved scope; mutations<br>rejected.|E2E|
|E2E-005|Responsive parity|Core workflows usable on mobile<br>and desktop.|E2E/manual|



## **15. Test environments and release gates** 

- Unit tests: validators, age calculation, conditional logic, permission policy, date ordering, QR token handling. 

- API/integration: authentication, authorization, DB constraints, record linking, idempotency, audit, field-level filtering. 

- UI/component: pagination, conditional sections, inline errors, answer persistence, loading/empty/error states. 

- E2E: worker registration → screening → contractor site link → clinician assessment → pathology result → read-only followup/research views. 

- Device/manual: Expo Go launch, QR scan, network changes, draft recovery, keyboard behavior, camera permissions, mobile browser and desktop browser. 

- Release gate: critical tests pass; no known cross-role data leak; high-severity defects resolved; untested manual/device behavior disclosed. 

## **16. Decisions requiring confirmation** 

|**ID**|**Question / ambiguity**|**Handling**|
|---|---|---|
|DEC-01|Is Admin read-onlyintentional?|Keepread-onlyuntil explicitlychanged.|
|DEC-02|What does SMP mean?|Do not mapuntil lab owner confirms.|
|DEC-03|Does Mobile Brand mean phone<br>brand/model?|Confirm purpose and necessity.|
|DEC-04|Does Qualification mean education?|Confirm options/free text and required<br>status.|
|DEC-05|Last detection asks month/year but provides<br>time categories.|Choose one representation or confirm need<br>for both.|
|DEC-06|Some migration-duration choices overlap or<br>leavegaps.|Approve mutually exclusive complete ranges.|
|DEC-07|Who creates/verifies worker accounts?|Define self-registration vs assisted<br>registration and duplicate resolution.|
|DEC-08|What diagnosis/treatment data may<br>contractors see?|Minimum necessary; distinguish reported<br>from verified.|
|DEC-09|Which diagnosis source is authoritative?|i<br>Avoid overwritingclinician/pathologyrecords.|
|DEC-10|What can Health Worker see?|Define assigned scope and minimum<br>necessaryfields.<br>i i|
|DEC-11|What data can Research Lab access?<br>i|Approve fields, de-identification, exports,<br>identifierpolicy.<br>i|
|DEC-12|Is worker confirmation needed for QR site<br>linking?|Approve consent, notification, and unlinking<br>behavior.|
|DEC-13|What clinical ranges/escalation rules are<br>approved?|Do not implement until approved protocol<br>supplied.|
|DEC-14|Are Hindi/Bengali translations required at<br>launch?|Approve reviewed translations.|
|DEC-15|Should travel be repeatable?|Recommend multiple Travel Episode records.|



## **17. Definition of done** 

- Every approved question is present in the correct section with reviewed labels/options. 

- Every field has a type, required/optional status, conditional rule, and validation or an explicit unresolved decision. 

- Records link through stable Worker ID, not mobile as primary key. 

- Role and record-scope permissions are API-tested, including read-only roles. 

- Pagination, draft recovery, error handling, review/submit, duplicate prevention, and responsive layouts are tested. 

- TDD evidence exists: test first, expected failure observed, implementation passes, regression suite passes. 

- Testing report lists actual commands/results and untested device/manual behavior. 

- No clinical rule or data requirement is silently invented. 

## **Appendix A — Workflow overview** 

|**Actor**|**Action**|**Linked record/result**<br>i|
|---|---|---|
|Labour Worker|Register and complete screening|Worker Profile + versioned Screening<br>Submission|
|Contractor|Create site and link worker by QR/search|Site + Site Membership<br>i|
|Clinician|Search Worker ID and record assessment|Clinical Assessment linked to Worker Profile|
|Pathologist|Search Worker ID and record<br>diagnostic/follow-upresult|Laboratory Investigation linked to Worker<br>Profile|
|Health Worker|Read assigned follow-up|Read-onlyassigned follow-upview|
|Research Lab|Read approved dataset|Read-onlyscoped research view|
|Admin|View authorized operational records|Read-onlyoversight view|



_Status: Draft baseline for stakeholder review. This is a product/workflow specification, not proof that the features are implemented or clinically approved._ 

