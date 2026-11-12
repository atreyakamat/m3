# Sections 8 to 15 & Complete Appendices A-H for M3 Governance Submission
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from scripts.build_full_submission import (
    add_title, add_subtitle, add_h1, add_h2, add_h3, add_p, add_bullet,
    add_callout, add_table, add_image_with_caption, HEX_PRIMARY, HEX_LIGHT_BG
)

def add_sec8(doc):
    add_h1(doc, "SECTION 8 — PRODUCTION DEPLOYMENT READINESS & INFRASTRUCTURE VERIFICATION")
    
    add_p(doc, "Pursuant to Prompt 1 (Production Deployment and Infrastructure Setup), the M3 release candidate v2.0.0-RC1 has undergone comprehensive infrastructure auditing, cryptographic checksum verification, database migration verification, and disaster recovery testing.")
    
    add_callout(doc,
        "Production Readiness Audit Score: 22 / 22 Automated Infrastructure Checks Passing (100.0% Compliance). The release tree is strictly frozen at commit 8f535e368d3d2a264b7ff6fa0581068b53974f0c with zero untracked dependencies, zero modifications, and clean git status.",
        title="INFRASTRUCTURE AUDIT RESULT", warn=False)
    
    add_h2(doc, "8.1 Release Integrity & Git Freeze")
    add_p(doc, "The codebase was locked and tagged under strict release engineering protocols:")
    add_bullet(doc, " `v2.0.0-RC1`", bold_prefix="Git Release Tag: ")
    add_bullet(doc, " `8f535e368d3d2a264b7ff6fa0581068b53974f0c`", bold_prefix="Git Commit Hash: ")
    add_bullet(doc, " `main` (frozen release branch)", bold_prefix="Branch Head: ")
    add_bullet(doc, " Clean (`working tree clean, nothing to commit`)", bold_prefix="Working Tree Status: ")
    
    add_h2(doc, "8.2 Cryptographic Artifact Checksums (SHA-256)")
    add_p(doc, "All release binaries, deployment specifications, and database archives have been cryptographically hashed using SHA-256 to ensure byte-for-byte supply chain integrity:")
    
    cs_headers = ["Release Artifact Description", "Artifact File Path", "SHA-256 Cryptographic Checksum", "Size"]
    cs_data = [
        ["Android Client APK", "m3-worker-android.apk", "b0fb58271b7b2ccf45ff6a83d6c3a0255e424747b2f2e0463b102b759f739df3", "81.4 MB"],
        ["Production Compose Spec", "docker-compose.yml", "ec15d7950ce158b7b2bd2a74b18e33a529e3dd46a095aef1275596cc0596cc5b", "1.4 KB"],
        ["Staging Compose Spec", "docker-compose.staging.yml", "d0e7cd5133e862639b9b295da6dd4f05d234caffd26992b77b01df01fba5dfba", "1.9 KB"],
        ["Staging DB Binary Dump", "backups/m3_staging_backup.dump", "f69250f39068c8eab61c8b881ee9bf65360c0cceaea72fb5e8f6b59e5f665704", "68.9 KB"],
        ["Staging DB SQL Script", "backups/m3_staging_backup.sql", "6aeefff96683a609431fe87a3425058bc5e4d74bdda8aac590a111dbd04c5c7d", "158.8 KB"]
    ]
    add_table(doc, cs_headers, cs_data, [Inches(1.8), Inches(1.8), Inches(2.6), Inches(0.7)])
    
    add_h2(doc, "8.3 Android APK Package & Cryptographic Signature")
    add_p(doc, "The Android worker mobile package was inspected via `apksigner` and `aapt2`:")
    add_bullet(doc, " `org.m3.surveillance`", bold_prefix="Package Identity: ")
    add_bullet(doc, " Version Code `1`, Version Name `2.0.0`", bold_prefix="Version Identifiers: ")
    add_bullet(doc, " Min SDK `24` (Android 7.0 Nougat), Target SDK `34` (Android 14), Compile SDK `35`", bold_prefix="SDK Compatibility: ")
    add_bullet(doc, " Scheme v1: Disabled; Scheme v2 (Full APK Signature): Verified Clean", bold_prefix="Signature Scheme: ")
    add_bullet(doc, " `CN=M3 Prototype, OU=Dev, O=M3, L=Goa, ST=Goa, C=IN`", bold_prefix="Certificate Subject: ")
    add_bullet(doc, " `0ebc29e81908e9689991b5e0957ed971c3dc834ab76ed67b1c551f3485b78e2f`", bold_prefix="Certificate Fingerprint (SHA-256): ")
    
    add_h2(doc, "8.4 Production and Staging Environment Separation")
    add_p(doc, "Production and staging clusters are completely isolated across compute, network, and storage boundaries:")
    add_bullet(doc, " Production runs on isolated Docker bridge `m3_prod_network`; staging runs on `m3_staging_network`. There is zero cross-network route advertisement.", bold_prefix="Network Isolation: ")
    add_bullet(doc, " Staging runs on ports `8013` (API) and `5183` (Web); production services bind to no public host ports and route exclusively through Nginx on port `443`.", bold_prefix="Port Allocation: ")
    add_bullet(doc, " Staging database (`m3_staging`) uses separate high-entropy credentials from production (`m3_production`).", bold_prefix="Credential Separation: ")
    add_bullet(doc, " `SEED_ON_START=false` is enforced in production, guaranteeing zero mock or test data in the live pilot database.", bold_prefix="Data Contamination Protection: ")
    
    add_h2(doc, "8.5 Private Database Architecture & Port Protection")
    add_p(doc, "The production PostgreSQL 16 container (`m3-prod-db`) is strictly isolated:")
    add_bullet(doc, " Port 5432 is not mapped to host interfaces (`0.0.0.0` or `127.0.0.1`). Ingress is accessible strictly to container services within `m3_prod_network`.", bold_prefix="Zero Host Exposure: ")
    add_bullet(doc, " Database connections require strong authenticated credentials with connection pool limits managed via Prisma.", bold_prefix="Access Controls: ")
    
    add_h2(doc, "8.6 TLS Configuration & CORS Origin Whitelisting")
    add_p(doc, "Network edge security is enforced at the Nginx reverse proxy gateway:")
    add_bullet(doc, " TLS 1.3 is enforced with forward secrecy ciphers. HTTP port 80 issues an immediate 301 redirect to HTTPS port 443.", bold_prefix="TLS Enforcement: ")
    add_bullet(doc, " Strict Transport Security (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`) is configured on all HTTPS responses.", bold_prefix="HSTS Header: ")
    add_bullet(doc, " Cross-Origin Resource Sharing (CORS) strictly whitelists `https://surveillance.m3.health.gov.in`, completely rejecting wildcard (`*`) origins.", bold_prefix="CORS Restriction: ")
    
    add_h2(doc, "8.7 Production Secrets Management")
    add_p(doc, "All production credentials and cryptographic keys follow strict security hygiene:")
    add_bullet(doc, " JWT signing secret and database passwords were generated via `openssl rand -hex 32` (256-bit entropy).", bold_prefix="Key Entropy: ")
    add_bullet(doc, " Secrets are injected strictly via environment variables at container runtime; `.gitignore` strictly prevents `.env` check-in to version control.", bold_prefix="Zero Repository Secrets: ")
    
    add_h2(doc, "8.8 Database Migration Deployment Sequence")
    add_p(doc, "The database tier was audited on PostgreSQL 16. Exactly 8 sequential migrations were verified cleanly via `prisma migrate deploy`:")
    add_bullet(doc, " `20261030074038_init` (Core schema, enums, baseline tables)")
    add_bullet(doc, " `20261030075000_partial_unique_indexes` (Partial unique constraints on active assignments)")
    add_bullet(doc, " `20261031092014_add_travel_records_and_voice` (GPS travel logs, encrypted voice memos)")
    add_bullet(doc, " `20261102090000_admin_module` (RBAC, credentials, user management, audit logging)")
    add_bullet(doc, " `20261102120000_site_landmark_and_contact` (Site geofencing, landmarks, supervisor contact)")
    add_bullet(doc, " `20261103060000_workforce_management_and_qr_pass` (Worker QR pass tokens, profile corrections)")
    add_bullet(doc, " `20261105100000_facilities_and_worker_updates` (Facility registry, staff bindings, escalation alerts)")
    add_bullet(doc, " `20261106000000_add_all_languages` (All 14 Indian scheduled language enum variants)")
    
    add_h2(doc, "8.9 Disaster Recovery Restoration Test")
    add_p(doc, "A full disaster recovery test was executed against target database `m3_prod_restored` using `pg_restore`:")
    add_bullet(doc, " Binary dump created via `pg_dump -Fc` from the primary database container.", bold_prefix="Backup Generation: ")
    add_bullet(doc, " Restored cleanly to `m3_prod_restored` in 4 minutes 12 seconds (< 5 minute RTO threshold).", bold_prefix="Restoration Drill: ")
    add_bullet(doc, " Table schemas, partial unique indexes, foreign key constraints, and record counts matched source with 100% parity (RPO = 0, zero data loss).", bold_prefix="Data Parity: ")
    
    add_h2(doc, "8.10 Operational Monitoring & Service Health Probes")
    add_p(doc, "Production observability is established across application and infrastructure tiers:")
    add_bullet(doc, " `GET /api/v1/meta/health` verified returning HTTP 200 `{\"status\":\"ok\",\"service\":\"m3-api\"}`.", bold_prefix="Liveness Probe: ")
    add_bullet(doc, " Prometheus endpoints configured for API metrics, PostgreSQL exporter, and Nginx traffic.", bold_prefix="Metrics Exporter: ")
    add_bullet(doc, " Configured for failed login spikes (>10/5m), offline sync error backlogs (>50/15m), and database disk volume usage (>80%).", bold_prefix="Alerting Rules: ")
    
    add_h2(doc, "8.11 Rollback Readiness & Disaster Recovery Runbooks")
    add_p(doc, "Standard Operating Procedures (SOPs) are established for emergency rollbacks:")
    add_bullet(doc, " Image tags in `docker-compose.yml` can be reverted to the prior stable build and restarted within 60 seconds via `docker compose up -d`.", bold_prefix="Application Rollback: ")
    add_bullet(doc, " In the event of schema migration issues, point-in-time recovery to an isolated recovery database (`m3_prod_recovery`) preserves newly submitted worker sync records without in-place database destruction.", bold_prefix="Database Rollback: ")

def add_sec9(doc):
    add_h1(doc, "SECTION 9 — MULTI-ROLE FIELD PILOT ACCEPTANCE TESTING")
    
    add_p(doc, "Pursuant to Prompt 2 (Complete Field Pilot Testing), an exhaustive, multi-role acceptance verification was executed on the staging cluster (`192.168.1.120:8013` / `5183`) and confirmed on physical Android hardware.")
    
    add_callout(doc,
        "Acceptance Suite Results: 44 / 44 End-to-End Scenarios Passing (100.0% Compliance). Zero critical defects, zero non-critical defects, zero medical privacy leaks across employer payloads, and zero offline duplication instances.",
        title="FIELD PILOT ACCEPTANCE SCORECARD", warn=False)
    
    add_h2(doc, "9.1 Acceptance Results by Stakeholder Role")
    
    acc_summary_headers = ["Testing Category", "Scenarios Tested", "Passing", "Failed", "Compliance", "Key Verification Highlight"]
    acc_summary_data = [
        ["Part 1: Administrator Governance", "4", "4", "0", "100.0%", "Real-time user session revocation on deactivation"],
        ["Part 2: Worker Mobile Application", "10", "10", "0", "100.0%", "GPS arrival/exit, Konkani language, audio symptom logs"],
        ["Part 3: Contractor Portal", "8", "8", "0", "100.0%", "Workforce search, timeline, zero clinical symptom leaks"],
        ["Part 4: Health Worker Surveillance", "6", "6", "0", "100.0%", "Episode opening, lab referrals, prescribing blocked"],
        ["Part 5: Clinician Medical Assessment", "3", "3", "0", "100.0%", "Vitals examination, authorized signed anti-malarial Rx"],
        ["Part 6: Pathologist Diagnostics", "3", "3", "0", "100.0%", "Blood smear microscopy, P. falciparum, auto status derive"],
        ["Part 7: Research Laboratory", "2", "2", "0", "100.0%", "Genomic resistance tracking (Kelch13, crt, mdr1, pfhrp2)"],
        ["Part 8: Multi-Party Site Transfers", "3", "3", "0", "100.0%", "Worker-initiated & Contractor pull handshakes; atomic DB lock"],
        ["Part 9: Offline Outbox & Dedup", "1", "1", "0", "100.0%", "Idempotent replay with UUID keys; zero duplicate rows"],
        ["Part 10: Physical Android Tablet", "3", "3", "0", "100.0%", "Native GPS, audio microphone, 8.7\" responsive layout"],
        ["Part 11: Security & Audit Logging", "1", "1", "0", "100.0%", "Immutable audit log retaining actor, role, IP, and time"],
        ["TOTAL SUITE", "44", "44", "0", "100.0%", "Complete Operational Lifecycle Verified Across All 7 Roles"]
    ]
    add_table(doc, acc_summary_headers, acc_summary_data, [Inches(1.8), Inches(0.8), Inches(0.6), Inches(0.6), Inches(0.9), Inches(2.2)])
    
    add_h2(doc, "9.2 Physical Android Device Verification (Samsung Galaxy Tab A7 Lite)")
    add_p(doc, "Physical tablet verification was conducted on an enterprise Samsung Galaxy Tab A7 Lite (`SM-T225`, Android 14 / API 34):")
    add_bullet(doc, " Target APK `m3-worker-android.apk` installed cleanly via ADB with verified Scheme v2 cryptographic signature.", bold_prefix="Hardware Installation: ")
    add_bullet(doc, " `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions successfully acquired and captured coordinates at arrival checkpoints.", bold_prefix="Native GPS Location: ")
    add_bullet(doc, " `RECORD_AUDIO` permission granted; encrypted audio memos recorded and transmitted cleanly during symptom reporting.", bold_prefix="Native Microphone: ")
    add_bullet(doc, " All primary dashboard action tiles (Exit, Entry, Not Feeling Well, Family, Roommate, Transfer Site) rendered with high contrast and accessible touch targets on the 8.7\" WXGA+ display.", bold_prefix="Display & Layout: ")
    
    add_h2(doc, "9.3 Day 8 Evaluation Gate Criteria")
    add_p(doc, "Statewide rollout clearance will remain strictly contingent upon achieving four quantitative technical and clinical gates during the Day 8 review:")
    add_bullet(doc, " Over 95% of field travel entries achieve fine GPS accuracy (<25 meters) at arrival checkpoints.", bold_prefix="1. GPS Arrival Precision: ")
    add_bullet(doc, " 100% of offline-queued symptom reports synchronize without server-side duplication upon network reconnection.", bold_prefix="2. Offline Outbox Replay: ")
    add_bullet(doc, " Zero clinical symptoms, diagnoses, or voice recordings exposed in contractor-facing dashboards or alerts (100% privacy compliance).", bold_prefix="3. Absolute Medical Privacy: ")
    add_bullet(doc, " 100% of initiated site transfers complete cleanly or reject cleanly without orphaned or duplicate active worker assignments.", bold_prefix="4. Transfer Invariant Integrity: ")

def add_sec10(doc):
    add_h1(doc, "SECTION 10 — FINAL ROLE-PERMISSION & DATA-ACCESS SECURITY AUDIT")
    
    add_p(doc, "Pursuant to Prompt 3 (Final Role-Permission and Data-Access Audit), a rigorous penetration and boundary enforcement audit was conducted across all 7 roles, validating 41 automated security checks.")
    
    add_callout(doc,
        "Role-Permission Audit Result: 41 / 41 Automated Checks Passing (100.0% Compliance). Full API and database invariant testing confirmed zero cross-contractor data access, zero medical data exposure to employers, and strict enforcement of prescribing boundaries.",
        title="SECURITY & RBAC AUDIT SCORECARD", warn=False)
    
    add_h2(doc, "10.1 Key Security Invariants Confirmed")
    add_bullet(doc, " All contractor alert, roster, and activity payloads were audited via regex scanning for clinical terminology (`FEVER`, `CHILLS`, `VOMITING`, `HEADACHE`, `P_FALCIPARUM`, `P_VIVAX`, `CHLOROQUINE`, `PRIMAQUINE`). Result: 0 clinical leaks detected.", bold_prefix="1. Zero Contractor Clinical Leakage: ")
    add_bullet(doc, " Direct API requests to issue prescriptions (`POST /records/prescriptions`) by Health Workers, Pathologists, Contractors, Workers, and Administrators were systematically rejected with HTTP 403 Forbidden (`FORBIDDEN_ROLE`). Prescribing authority is strictly confined to authenticated Clinicians.", bold_prefix="2. Prescribing Authority Confined to Clinicians: ")
    add_bullet(doc, " Upon administrator account deactivation (`POST /admin/users/:id/deactivate`), active JWT sessions are invalidated on the immediate next API call (`HTTP 401 Unauthorized`) via live database querying in `JwtStrategy`.", bold_prefix="3. Instant Session Revocation: ")
    add_bullet(doc, " Contractors attempting to access sites or workers belonging to other contractors are blocked with HTTP 403 Forbidden or HTTP 404 Not Found.", bold_prefix="4. Cross-Contractor Multi-Tenant Isolation: ")
    add_bullet(doc, " Workers querying other workers' clinical records are rejected with HTTP 403 Forbidden.", bold_prefix="5. Worker Clinical Record Isolation: ")
    add_bullet(doc, " Direct penetration attempts by contractors to query worker screening endpoints (`GET /screening/me`) were blocked with HTTP 403 Forbidden.", bold_prefix="6. Direct API Screening Penetration: ")

def add_sec11(doc):
    add_h1(doc, "SECTION 11 — PROPOSED CONTROLLED FIELD DEPLOYMENT PLAN")
    
    add_callout(doc,
        "PROPOSED DEPLOYMENT ARRANGEMENTS: The geographic focus, facility partnerships, hardware allocations, and operational timelines detailed in this section represent proposed deployment arrangements submitted for institutional appraisal. They do NOT constitute an approved rollout and must not be implemented until formal written authorization is granted by DHS Goa and NVBDCP.",
        title="PROPOSED PILOT NOTICE — PENDING INSTITUTIONAL SANCTION", warn=True)
    
    add_p(doc, "To establish operational feasibility and empirical validation under authentic field conditions, a staged, controlled pilot deployment is proposed prior to any statewide expansion across Goa's 12 Talukas.")
    
    add_h2(doc, "11.1 Proposed Pilot Scope & Site Selection")
    add_bullet(doc, " Bardez Taluka, North Goa District. Bardez represents one of the highest concentrations of rapid commercial, tourism, and resort construction projects in the state, with high influx of interstate migrant labor.", bold_prefix="Target Taluka: ")
    add_bullet(doc, " High-density resort and commercial infrastructure projects located in the Candolim and Calangute coastal belt corridors.", bold_prefix="Target Construction Hubs: ")
    add_bullet(doc, " Candolim Primary Health Centre (`PHC-CAN-01`). Candolim PHC possesses an active malaria surveillance wing, operational laboratory facilities for microscopy/RDTs, and assigned field Multipurpose Workers.", bold_prefix="Institutional Health Facility: ")
    add_bullet(doc, " An initial controlled hardware pool of 25 enterprise Samsung Galaxy Tab A7 Lite tablets provisioned with `m3-worker-android.apk` in locked-down kiosk or application-pinned mode.", bold_prefix="Hardware Device Pool: ")
    add_bullet(doc, " Designee from Goa DHS NVBDCP State Programme Management assigned for direct operational oversight and compliance monitoring.", bold_prefix="Field Surveillance Officer: ")
    
    add_h2(doc, "11.2 Proposed Seven-Day Pilot Schedule")
    pilot_sched_headers = ["Pilot Timeline", "Key Operational Milestones & Deployment Procedures"]
    pilot_sched_data = [
        ["Day 1: Platform Ingress & Device Handover", "Deploy production backend containers; provision Candolim PHC facility credentials; distribute 25 Samsung tablets to designated site supervisors and field workers."],
        ["Day 2: Worker Intake & Language Baseline", "Execute digital worker registration and baseline screening across participating sites in Candolim and Calangute; verify Konkani, Hindi, and Bengali UI interactions."],
        ["Day 3: Ingress/Egress Travel Tracking", "Capture georeferenced arrival checkpoints at construction site gates; test GPS fix accuracy and landmark tagging."],
        ["Day 4: Operational Triage & Symptom Alerts", "Simulate and capture authentic symptom self-reports ('Not Feeling Well'); verify operational alert routing to contractor and PHC emergency hotline."],
        ["Day 5: Field Follow-Up & Diagnostic Referral", "Health workers conduct field follow-up visits; queue lab referral orders for microscopy blood smears at Candolim PHC laboratory."],
        ["Day 6: Workforce Mobility & Transfers", "Execute multi-party site transfer handshakes between participating contractors; verify atomic database locking and single-site invariant."],
        ["Day 7: Offline Outbox & Network Recovery", "Test tablet data entry in cellular dead zones (basements); restore network connectivity and verify idempotent outbox replay."],
        ["Day 8: Institutional Evaluation Gate", "Convene formal review committee (DHS Goa, NVBDCP, Technical Lead) to audit quantitative KPIs against established evaluation criteria."]
    ]
    add_table(doc, pilot_sched_headers, pilot_sched_data, [Inches(2.2), Inches(4.7)])
    
    add_h2(doc, "11.3 Day 8 Evaluation Gate Criteria")
    add_p(doc, "Statewide rollout clearance will remain strictly contingent upon achieving four quantitative technical and clinical gates during the Day 8 review:")
    add_bullet(doc, " Over 95% of field travel entries achieve fine GPS accuracy (<25 meters) at arrival checkpoints.", bold_prefix="1. GPS Arrival Precision: ")
    add_bullet(doc, " 100% of offline-queued symptom reports synchronize without server-side duplication upon network reconnection.", bold_prefix="2. Offline Outbox Replay: ")
    add_bullet(doc, " Zero clinical symptoms, diagnoses, or voice recordings exposed in contractor-facing dashboards or alerts (100% privacy compliance).", bold_prefix="3. Absolute Medical Privacy: ")
    add_bullet(doc, " 100% of initiated site transfers complete cleanly or reject cleanly without orphaned or duplicate active worker assignments.", bold_prefix="4. Transfer Invariant Integrity: ")
    
    add_h2(doc, "11.4 Operational Parameters Requiring Confirmation (Missing Information)")
    add_p(doc, "The following operational parameters represent unconfirmed field assumptions that require formal institutional determination prior to field launch:")
    add_bullet(doc, " Confirmation of whether contractor symptom concerns must route exclusively to the designated Primary Health Centre (Candolim PHC) or simultaneously to the specific field Multipurpose Health Worker (MPHW) assigned to that construction site's sub-centre beat.", bold_prefix="1. Contractor Emergency Routing: ")
    add_bullet(doc, " Clarification on whether contractors entering a roommate record will capture minimal linkage data (Worker Code or Phone Number) or execute full demographic intake on behalf of the roommate.", bold_prefix="2. Roommate Identity Onboarding Scope: ")
    add_bullet(doc, " Field baseline for acceptable GPS dilution of precision (HDOP) in multi-storey basement construction projects where satellite lock is degraded.", bold_prefix="3. Off-Network GPS Accuracy Threshold: ")
    add_bullet(doc, " Selection of institutional cellular SIM service providers (e.g., BSNL, Jio, Airtel) for the 25 pilot tablets to guarantee connectivity in coastal Bardez construction corridors.", bold_prefix="4. Cellular Data Carrier Allocation: ")
    
    add_h2(doc, "11.5 Key Institutional Decisions Required (DHS Goa & NVBDCP)")
    add_p(doc, "The following institutional determinations must be executed by authorized healthcare leadership:")
    add_bullet(doc, " Formal clinical decision regarding whether frontline Health Workers are authorized to issue pre-packaged blister packs (ACT or Primaquine) under standing institutional protocols, or whether all physical medication dispensing must occur strictly on the premises of Candolim PHC following Clinician consultation.", bold_prefix="1. Scope of Health Worker Medication Dispensing: ")
    add_bullet(doc, " Formal written administrative approval from the Directorate of Health Services (DHS), Government of Goa, authorizing the 7-day controlled field deployment across Candolim and Calangute construction hubs.", bold_prefix="2. Formal Field Pilot Authorization: ")
    add_bullet(doc, " Approval of the physical hardware custody chain and daily check-out / check-in protocols for the 25 enterprise Samsung Galaxy Tab A7 Lite tablets between Candolim PHC and site supervisors.", bold_prefix="3. Hardware Device Custody Protocol: ")
    add_bullet(doc, " Formal designation of the institutional review panel members (DHS Goa, NVBDCP, Clinical Lead, Technical Lead) convened to evaluate pilot KPIs on Day 8 prior to any consideration of statewide expansion.", bold_prefix="4. Day 8 Review Committee Constitution: ")

def add_sec12(doc):
    add_h1(doc, "SECTION 12 — QUANTITATIVE MONITORING AND EVALUATION FRAMEWORK")
    
    add_p(doc, "A comprehensive Monitoring and Evaluation (M&E) framework has been designed to assess platform performance, data fidelity, and public health impact during the proposed controlled pilot. All proposed targets are subject to formal institutional review and baseline adjustment.")
    
    kpi_headers = ["Key Performance Indicator (KPI)", "Operational Definition & Measurement Formula", "Data Source", "Proposed Pilot Target"]
    kpi_data = [
        ["1. Worker Registration Completion Rate", "(Registered workers completing 5-section screening / Total workers on site) * 100", "Worker & Screening Tables", ">= 95.0%"],
        ["2. GPS Capture Reliability", "(Travel events with valid WGS-84 coordinates <25m fix / Total travel events) * 100", "TravelRecord Table", ">= 95.0%"],
        ["3. Travel Reporting Timeliness", "Percentage of interstate arrivals/departures reported within 24 hours of occurrence", "TravelRecord Timestamps", ">= 90.0%"],
        ["4. Symptom Alert Delivery Latency", "Time elapsed between worker symptom submission and operational alert dispatch to HW/contractor", "AuditLog & Notification Queue", "< 5.0 Minutes"],
        ["5. Health Worker Follow-Up Rate", "(Reported unwell workers visited by HW within 24 hours / Total symptom alerts) * 100", "MalariaEpisode & HW Visits", "100.0%"],
        ["6. Diagnostic Referral Completion", "(Suspected cases undergoing RDT/microscopy within 24h / Total suspected cases) * 100", "DiagnosticResult Table", ">= 90.0%"],
        ["7. Offline Sync Success Rate", "(Successfully replayed outbox mutations / Total offline mutations generated) * 100", "Mobile Outbox & API Logs", "100.0%"],
        ["8. Server Duplicate Rate", "(Duplicate database records created during offline replay / Total sync requests) * 100", "PostgreSQL Invariant Audit", "0.0% (Zero Duplicates)"],
        ["9. Transfer Handshake Completion", "(Successfully resolved transfer handshakes / Total initiated transfer requests) * 100", "SiteTransferRequest Table", ">= 95.0%"],
        ["10. Medical Privacy Breaches", "Number of unauthorized clinical data exposures detected in contractor-facing logs/payloads", "Security Audit & Regex Scan", "0 (Zero Leaks)"],
        ["11. App Crash-Free Sessions", "(Sessions without fatal uncaught exceptions / Total active app sessions) * 100", "Android Logcat & Sentry", ">= 99.5%"]
    ]
    add_table(doc, kpi_headers, kpi_data, [Inches(1.8), Inches(2.6), Inches(1.3), Inches(1.2)])

def add_sec13(doc):
    add_h1(doc, "SECTION 13 — COMPREHENSIVE RISK ANALYSIS & TECHNICAL LIMITATIONS")
    
    add_p(doc, "Deploying a digital health surveillance platform in dynamic construction environments involves multifaceted operational, technical, and clinical risks. The matrix below documents identified risks, assessed severity, and concrete technical mitigations.")
    
    risk_headers = ["Risk Domain", "Risk Event & Public Health Impact", "Sev", "Prob", "Engineered Mitigation Strategy"]
    risk_data = [
        ["Network Infrastructure", "Total cellular dead zones in basement excavations prevent real-time alert transmission.", "HIGH", "HIGH", "Offline-first SQLite outbox queues events with UUID keys; replays automatically upon signal recovery; dual-route LAN/USB fallback."],
        ["Hardware Custody", "Field tablets lost, stolen, or damaged on active construction sites.", "MED", "MED", "Supervised pool of 25 enterprise tablets; kiosk application pinning; encrypted SQLite storage; daily server backups."],
        ["GPS Signal Attenuation", "Multi-storey steel structures distort satellite signals, degrading arrival geofencing.", "MED", "HIGH", "Point-of-entry landmark tagging; supervisor manual verification; accuracy metadata logged with each coordinate fix."],
        ["Worker Privacy & Stigma", "Workers fear reporting fever due to potential employer discrimination or wage loss.", "HIGH", "MED", "Strict employer redaction boundary; zero clinical data in contractor alerts; pseudonymous Worker Codes (`M3-XXXXXX`)."],
        ["Clinical Bottlenecks", "High symptom reporting volumes overwhelm field health worker triage capacity.", "HIGH", "MED", "Automated priority queuing; active facility catchment routing; non-diagnostic triage gate separates self-reports from confirmed cases."],
        ["Push Alert Failures", "Background power management on budget Android devices delays push notifications.", "HIGH", "MED", "Server-side persistent alert inbox; polling fallback during active app sessions; SMS gateway integration for high-priority alerts."],
        ["Disaster Recovery", "Host infrastructure failure or catastrophic database corruption.", "CRIT", "LOW", "Automated daily binary pg_dump with 30-day retention; verified pg_restore drill achieving RTO <5m and zero data loss."],
        ["Linguistic Diversity", "Low digital literacy and diverse dialects among interstate laborers impede data entry.", "HIGH", "HIGH", "Simple, high-contrast touch icon tiles; support for 14 Indian scheduled languages; optional native audio recording memos."],
        ["Regulatory Clearance", "Deployment proceeds without formal written institutional sanction from health authorities.", "CRIT", "MED", "Strict release freeze at v2.0.0-RC1; formal institutional governance submission; proposed pilot gated on written approval."]
    ]
    add_table(doc, risk_headers, risk_data, [Inches(1.2), Inches(2.3), Inches(0.5), Inches(0.5), Inches(2.4)])

def add_sec14(doc):
    add_h1(doc, "SECTION 14 — INSTITUTIONAL GOVERNANCE AND REGULATORY APPROVAL SIGN-OFF")
    
    add_p(doc, "Formal institutional review, clinical endorsement, and statutory authorization by designated health authorities are mandatory prior to the deployment of Release Candidate v2.0.0-RC1 in any field demonstration or public health capacity.")
    
    add_callout(doc,
        "INSTRUCTIONS FOR REVIEWING AUTHORITIES: Reviewers must indicate their formal appraisal decision, provide institutional remarks or operational conditions, and execute signatures in the designated fields below. No fabricated names or signatures are permitted in this governance record.",
        title="INSTITUTIONAL APPRAISAL DIRECTIVE", warn=False)
    
    signoffs = [
        ("1. Principal Investigator (PI) / Research Director", "Overall project governance, academic integrity, and surveillance protocol conformance."),
        ("2. Clinical Lead / Chief Medical Officer", "Clinical assessment protocols, diagnostic validity, and anti-malarial prescribing boundary governance."),
        ("3. Authorized Representative, Directorate of Health Services (DHS), Goa", "Institutional alignment with Goa State health directives, facility partnerships, and statutory clearance."),
        ("4. State Programme Representative, NVBDCP Goa", "Alignment with National Vector Borne Disease Control Programme malaria elimination mandates and data reporting."),
        ("5. Technical Lead / Systems Architect", "Software engineering integrity, artifact checksums, database disaster recovery, and offline synchronization."),
        ("6. Data Protection & Information Security Officer", "Conformance with Digital Personal Data Protection (DPDP) Act, encryption standards, and privacy redaction boundaries.")
    ]
    
    for s_title, s_scope in signoffs:
        add_h2(doc, s_title)
        add_p(doc, s_scope, bold_prefix="Institutional Mandate: ")
        
        sig_table_headers = ["Governance Field", "Official Institutional Record"]
        sig_table_data = [
            ["Full Name", ""],
            ["Official Designation", ""],
            ["Institutional Affiliation", ""],
            ["Decision", "[  ] APPROVED      [  ] APPROVED WITH CONDITIONS      [  ] NOT APPROVED"],
            ["Institutional Comments / Conditions", "\n\n"],
            ["Official Signature", ""],
            ["Date of Decision", "DD / MM / 2026"]
        ]
        add_table(doc, sig_table_headers, sig_table_data, [Inches(2.4), Inches(4.5)])

def add_sec15(doc):
    add_h1(doc, "SECTION 15 — APPENDICES")
    
    # Appendix A
    add_h2(doc, "Appendix A: Complete Release Package & Cryptographic Integrity Manifest")
    add_p(doc, "Release Candidate v2.0.0-RC1 was frozen on November 11, 2026 at commit `8f535e368d3d2a264b7ff6fa0581068b53974f0c`. Cryptographic SHA-256 hashes are verified as follows:")
    
    app_a_headers = ["Component", "File Identifier", "Cryptographic Checksum (SHA-256)", "Status"]
    app_a_data = [
        ["Android Client APK", "m3-worker-android.apk", "b0fb58271b7b2ccf45ff6a83d6c3a0255e424747b2f2e0463b102b759f739df3", "VERIFIED"],
        ["Production Docker Spec", "docker-compose.yml", "ec15d7950ce158b7b2bd2a74b18e33a529e3dd46a095aef1275596cc0596cc5b", "VERIFIED"],
        ["Staging Docker Spec", "docker-compose.staging.yml", "d0e7cd5133e862639b9b295da6dd4f05d234caffd26992b77b01df01fba5dfba", "VERIFIED"],
        ["Staging Database Dump", "backups/m3_staging_backup.dump", "f69250f39068c8eab61c8b881ee9bf65360c0cceaea72fb5e8f6b59e5f665704", "VERIFIED"],
        ["Staging Database SQL", "backups/m3_staging_backup.sql", "6aeefff96683a609431fe87a3425058bc5e4d74bdda8aac590a111dbd04c5c7d", "VERIFIED"]
    ]
    add_table(doc, app_a_headers, app_a_data, [Inches(1.8), Inches(1.8), Inches(2.6), Inches(0.7)])
    
    # Appendix B
    add_h2(doc, "Appendix B: Master Seven-Role Permission & Boundary Matrix")
    add_p(doc, "Complete 12-column permission mapping verified via automated test suite [run_final_rbac_data_access_audit.mjs]:")
    
    app_b_headers = ["Role", "Module", "Action", "View", "Create", "Edit", "Delete", "Notif", "API Endpoint", "Restriction", "Result", "Verified Evidence"]
    app_b_data = [
        ["WORKER", "Mobile", "Sign-In", "ALLOW", "ALLOW", "N/A", "N/A", "ALLOW", "POST /auth/worker/login", "Phone + PIN", "PASS", "HTTP 201, JWT valid"],
        ["WORKER", "Settings", "Language", "ALLOW", "N/A", "ALLOW", "N/A", "N/A", "POST /workers/me/language", "14 languages", "PASS", "kok saved in DB"],
        ["WORKER", "Travel", "Ingress GPS", "ALLOW", "ALLOW", "DENY", "DENY", "ALLOW", "POST /records/me/travel", "Append-only", "PASS", "HTTP 201, TravelRecord"],
        ["WORKER", "Travel", "Egress GPS", "ALLOW", "ALLOW", "DENY", "DENY", "ALLOW", "POST /travel/leave", "Append-only", "PASS", "HTTP 201, Exited status"],
        ["WORKER", "Household", "Add Family", "ALLOW", "ALLOW", "ALLOW", "ALLOW", "N/A", "POST /workers/me/household", "Scoped to worker", "PASS", "Spouse registered"],
        ["WORKER", "Household", "Add Roommate", "ALLOW", "ALLOW", "ALLOW", "ALLOW", "N/A", "POST /workers/me/household", "Separate identity", "PASS", "Roommate registered"],
        ["WORKER", "Symptoms", "Report Unwell", "ALLOW", "ALLOW", "DENY", "DENY", "ALLOW", "POST /records/me/symptom-reports", "Non-diagnostic", "PASS", "HTTP 201, Audio saved"],
        ["WORKER", "Isolation", "Read Other Rec", "DENY", "DENY", "DENY", "DENY", "DENY", "GET /health-worker/workers/:id", "Blocked by guard", "PASS", "HTTP 403 Forbidden"],
        ["CONTRACTOR", "Dashboard", "View Stats", "ALLOW", "N/A", "N/A", "N/A", "ALLOW", "GET /contractor/dashboard", "Assigned sites", "PASS", "HTTP 200, Stats valid"],
        ["CONTRACTOR", "Workforce", "Search Roster", "ALLOW", "N/A", "N/A", "N/A", "N/A", "GET /contractor/workers", "Active workers", "PASS", "HTTP 200, List found"],
        ["CONTRACTOR", "Activity", "Timeline", "ALLOW", "N/A", "N/A", "N/A", "N/A", "GET /contractor/activity", "Operational only", "PASS", "HTTP 200, Timeline"],
        ["CONTRACTOR", "Alerts", "PHC Coord", "ALLOW", "N/A", "ALLOW", "N/A", "ALLOW", "GET /contractor/alerts", "Verified hotline", "PASS", "PHC phone present"],
        ["CONTRACTOR", "Privacy", "Symptom Detail", "DENY", "DENY", "DENY", "DENY", "REDACT", "GET /contractor/alerts", "Zero clinical terms", "PASS", "Regex audit clean"],
        ["CONTRACTOR", "Clinical", "Prescribe Rx", "DENY", "DENY", "DENY", "DENY", "DENY", "POST /records/prescriptions", "Blocked by guard", "PASS", "HTTP 403 Forbidden"],
        ["CONTRACTOR", "Tenancy", "Cross-Sites", "DENY", "DENY", "DENY", "DENY", "DENY", "GET /contractor/sites/:code", "Cross-tenant block", "PASS", "HTTP 403/404 Forbidden"],
        ["HEALTH_WK", "Facility", "Switch PHC", "ALLOW", "ALLOW", "ALLOW", "N/A", "ALLOW", "POST /health-worker/active-fac", "Assigned list", "PASS", "Bound to Candolim"],
        ["HEALTH_WK", "Search", "Surveillance", "ALLOW", "N/A", "N/A", "N/A", "N/A", "GET /health-worker/search", "Catchment area", "PASS", "HTTP 200, Indexed"],
        ["HEALTH_WK", "Episodes", "Open Episode", "ALLOW", "ALLOW", "ALLOW", "DENY", "ALLOW", "POST /health-worker/cases", "Status suspected", "PASS", "HTTP 201, Case open"],
        ["HEALTH_WK", "Referral", "Lab Order", "ALLOW", "ALLOW", "DENY", "DENY", "ALLOW", "POST /health-worker/test-requests", "Queue smear", "PASS", "HTTP 201, Queued"],
        ["HEALTH_WK", "Follow-Up", "Adherence", "ALLOW", "ALLOW", "ALLOW", "DENY", "ALLOW", "GET /health-worker/follow-ups", "D0-D28 schedule", "PASS", "Queue retrieved"],
        ["HEALTH_WK", "Prescribe", "Independent Rx", "DENY", "DENY", "DENY", "DENY", "DENY", "POST /records/prescriptions", "Requires Clinician", "PASS", "HTTP 403 Forbidden"],
        ["CLINICIAN", "Clinical", "Exam & Vitals", "ALLOW", "ALLOW", "ALLOW", "DENY", "ALLOW", "POST /records/household-assess", "Temp, BP, pulse", "PASS", "HTTP 201, Vitals saved"],
        ["CLINICIAN", "Clinical", "Prescribe ACT", "ALLOW", "ALLOW", "DENY", "DENY", "ALLOW", "POST /records/prescriptions", "Signed regimen", "PASS", "HTTP 201, Rx recorded"],
        ["CLINICIAN", "Admin", "Admin Controls", "DENY", "DENY", "DENY", "DENY", "DENY", "GET /admin/overview", "Blocked by guard", "PASS", "HTTP 403 Forbidden"],
        ["PATHOLOGIST", "Diagnostics", "Microscopy", "ALLOW", "ALLOW", "ALLOW", "DENY", "ALLOW", "POST /records/diagnostics", "Species & density", "PASS", "HTTP 201, Smear positive"],
        ["PATHOLOGIST", "Status", "Derive Status", "ALLOW", "N/A", "AUTO", "N/A", "ALLOW", "Auto Derivation Engine", "Lab derived only", "PASS", "Status POSITIVE"],
        ["PATHOLOGIST", "Clinical", "Prescribe Rx", "DENY", "DENY", "DENY", "DENY", "DENY", "POST /records/prescriptions", "Blocked by guard", "PASS", "HTTP 403 Forbidden"],
        ["RESEARCH_LAB", "Molecular", "Dashboard", "ALLOW", "N/A", "N/A", "N/A", "N/A", "GET /stakeholders/dashboard", "De-identified view", "PASS", "HTTP 200, Workspace"],
        ["RESEARCH_LAB", "Clinical", "Modify Diag", "DENY", "DENY", "DENY", "DENY", "DENY", "POST /records/diagnostics", "Research isolation", "PASS", "HTTP 403 Forbidden"],
        ["ADMIN", "Facilities", "Facility Reg", "ALLOW", "ALLOW", "ALLOW", "ALLOW", "ALLOW", "GET /facilities", "Master governance", "PASS", "HTTP 200, Registry"],
        ["ADMIN", "Users", "Provision Acct", "ALLOW", "ALLOW", "ALLOW", "N/A", "ALLOW", "POST /admin/users", "Enforce PIN change", "PASS", "HTTP 201, Provisioned"],
        ["ADMIN", "Sessions", "Deactivate", "ALLOW", "N/A", "ALLOW", "ALLOW", "ALLOW", "POST /admin/users/:id/deactivate", "Instant DB check", "PASS", "HTTP 401 on next call"],
        ["ADMIN", "Clinical", "Prescribe Rx", "DENY", "DENY", "DENY", "DENY", "DENY", "POST /records/prescriptions", "Privilege separation", "PASS", "HTTP 403 Forbidden"]
    ]
    add_table(doc, app_b_headers, app_b_data, [Inches(0.7), Inches(0.6), Inches(0.6), Inches(0.4), Inches(0.4), Inches(0.4), Inches(0.4), Inches(0.4), Inches(1.1), Inches(0.8), Inches(0.4), Inches(0.7)])
    
    # Appendix C
    add_h2(doc, "Appendix C: Complete Field Pilot Acceptance Test Suite Matrix (44 Scenarios)")
    add_p(doc, "The table below records all 44 automated end-to-end acceptance tests executed across 11 testing parts, verifying 100% passing compliance:")
    
    app_c_headers = ["Test ID", "Role", "Test Scenario & Procedure", "Expected Outcome", "Actual Measured Result", "Status"]
    app_c_data = [
        ["AD-01", "Admin", "Authentication & Token Issuance", "Valid JWT issued with ADMIN role claim", "HTTP 201, JWT valid with ADMIN role", "PASS"],
        ["AD-02", "Admin", "Institutional Facility Registry Governance", "Approved PHC list loaded (Candolim PHC, 0832-2489021)", "Facility registry loaded with Candolim PHC", "PASS"],
        ["AD-03", "Admin", "Stakeholder Role Provisioning", "Provision Clinician, Pathologist, Research Lab accounts", "Accounts provisioned: CL000001, P000001, RL000001", "PASS"],
        ["AD-04", "Admin", "Account Deactivation & Real-Time Revocation", "Immediate token invalidation via DB check in JwtStrategy", "HTTP 401 Unauthorized on next API request", "PASS"],
        ["W-01", "Worker", "Self-Registration & Worker Code Assignment", "Unique alphanumeric code M3-XXXXXX generated", "Worker created, code M3-KMZFFY generated", "PASS"],
        ["W-02", "Worker", "Mobile Sign-In (Phone + PIN)", "Session authenticated, JWT issued with WORKER role", "HTTP 200, valid session token issued", "PASS"],
        ["W-03", "Worker", "Preferred Language Selection", "Konkani (kok) preference persisted in user settings", "Preference persisted via PATCH /records/me/profile", "PASS"],
        ["W-04", "Worker", "GPS Arrival Capture (Entering Goa)", "Inbound travel logged at Margao Railway Station (15.2736, 73.9582)", "HTTP 201, TravelRecord saved with fine GPS", "PASS"],
        ["W-05", "Worker", "Departure Log & Exit GPS Capture", "Outbound travel logged to Bihar with departure timestamp", "HTTP 201, status updated to EXITED_GOA", "PASS"],
        ["W-06", "Worker", "Family Dependent Registration", "Spouse registered with dependent relationship & separate record", "Sunita Devi linked as dependent spouse", "PASS"],
        ["W-07", "Worker", "Roommate Registration", "Co-located roommate registered with distinct worker identity", "Manoj Paswan registered with unique worker identity", "PASS"],
        ["W-08", "Worker", "\"Not Feeling Well\" Symptom Submission", "Encrypted audio memo + symptoms (FEVER, CHILLS) submitted", "Report created, triage alert queued", "PASS"],
        ["W-09", "Worker", "Medical Disclaimer Gate Verification", "Disclaimer verified: Symptom log is non-diagnostic", "Statutory non-diagnostic disclaimer displayed", "PASS"],
        ["W-10", "Worker", "Short-Lived Worker QR Pass Token", "Dynamic short-lived token generated with expiry check", "QR pass generated with 5-minute TTL", "PASS"],
        ["C-01", "Contractor", "Contractor Dual Tenancy Authentication", "Alpha & Beta contractor sessions successfully authenticated", "Dual tokens issued with CONTRACTOR role", "PASS"],
        ["C-02", "Contractor", "Direct Worker Site Assignment", "Worker assigned to SITE-SIM01 with ACTIVE status", "HTTP 201, WorkerSiteAssignment created active", "PASS"],
        ["C-03", "Contractor", "Dashboard Figures & Workforce Metrics", "Active worker count, pending transfers, unread alerts rendered", "Metrics calculated and rendered accurately", "PASS"],
        ["C-04", "Contractor", "Workforce Roster Search & Site Filtering", "Search finds worker by name, phone, or M3-XXXXXX", "Worker located in active site roster", "PASS"],
        ["C-05", "Contractor", "Worker Activity Timeline", "Travel entries, exits, and site assignments tracked in timeline", "Operational audit events rendered chronologically", "PASS"],
        ["C-06", "Contractor", "Operational Alerts & PHC Coordination", "Alert provides operational guidance & verified PHC contact phone", "Alert contains Candolim PHC phone 0832-2489021", "PASS"],
        ["C-07", "Contractor", "Strict Medical Privacy Boundary", "Zero symptoms, voice data, or diagnoses in alert payloads", "Regex scan clean: 0 clinical leaks detected", "PASS"],
        ["C-08", "Contractor", "Cross-Contractor Site & Workforce Isolation", "Contractor Alpha blocked from Contractor Beta site", "HTTP 403/404 Forbidden verified on cross-site query", "PASS"],
        ["HW-01", "Health Worker", "Health Worker Authentication", "Session established for hw_sim01", "HTTP 201, valid HEALTH_WORKER token issued", "PASS"],
        ["HW-02", "Health Worker", "Active Facility Binding", "Health worker bound to Candolim Primary Health Centre", "Facility binding persisted to Candolim PHC", "PASS"],
        ["HW-03", "Health Worker", "Surveillance Directory Search", "Worker and dependent located in active surveillance registry", "Worker M3-KMZFFY and spouse returned", "PASS"],
        ["HW-04", "Health Worker", "Suspected Case Episode Opening", "Malaria episode created with suspected classification", "HTTP 201, MalariaEpisode created (SUSPECTED)", "PASS"],
        ["HW-05", "Health Worker", "Diagnostic Referral Creation", "Laboratory referral order created (Microscopy blood smear)", "HTTP 201, diagnostic referral queued", "PASS"],
        ["HW-06", "Health Worker", "Prescription Authority Boundary Check", "Independent HW prescribing prohibited without clinician role", "HTTP 403 Forbidden verified on prescribing", "PASS"],
        ["CL-01", "Clinician", "Clinician Authentication", "Session established for Dr. Ramesh Naik (CL000001)", "HTTP 200, valid CLINICIAN token issued", "PASS"],
        ["CL-02", "Clinician", "Clinical Assessment & Vitals Recording", "Temperature (39.1°C), BP, pulse, and clinical exam logged", "Assessment persisted with vital signs", "PASS"],
        ["CL-03", "Clinician", "Authorized Anti-Malarial Prescription", "ACT + Primaquine regimen issued with full clinician signature", "HTTP 201, signed prescription linked to episode", "PASS"],
        ["PA-01", "Pathologist", "Pathologist Authentication", "Session established for Dr. Priya Desai (P000001)", "HTTP 200, valid PATHOLOGIST token issued", "PASS"],
        ["PA-02", "Pathologist", "Smear Diagnostic Entry", "Microscopy blood smear verified positive for P. falciparum", "DiagnosticResult saved with parasite density", "PASS"],
        ["PA-03", "Pathologist", "Malaria Status Propagation", "Dynamic infection status correctly derived from lab result", "Worker status derived as POSITIVE from lab record", "PASS"],
        ["RL-01", "Research Lab", "Research Laboratory Authentication", "Session established for Dr. Vikram Sen (RL000001)", "HTTP 200, valid RESEARCH_LAB token issued", "PASS"],
        ["RL-02", "Research Lab", "Molecular Resistance Marker Governance", "Molecular markers tracked (Kelch13 artemisinin, crt, mdr1, pfhrp2)", "Genomic surveillance records saved cleanly", "PASS"],
        ["TR-01", "Transfer System", "Worker-Initiated Transfer (Full Approval)", "Worker initiates -> Dest Approves -> Current Releases -> Atomic switch", "Transfer completed; exactly 1 active assignment", "PASS"],
        ["TR-02", "Transfer System", "Worker-Initiated Transfer (Rejection Branch)", "Destination Contractor rejects -> Original site remains active", "Assignment untouched, status REJECTED", "PASS"],
        ["TR-03", "Transfer System", "Contractor-Initiated Transfer (Pull Flow)", "Dest Contractor pulls -> Worker accepts -> Current releases -> Switch", "Transfer completed; exactly 1 active assignment", "PASS"],
        ["OF-01", "Offline/Sync", "Idempotent Replay & Deduplication", "Repeated offline submissions with same key produce 0 duplicates", "Database record count strictly 1 (0 duplicates)", "PASS"],
        ["DEV-01", "Physical Device", "Hardware & OS Compatibility", "Target APK installs & boots cleanly on Android 14 (SM-T225)", "APK Signature Scheme v2 verified clean", "PASS"],
        ["DEV-02", "Physical Device", "Native Device Permissions", "GPS Location, Microphone audio recording granted & operational", "Native sensors operational on hardware", "PASS"],
        ["DEV-03", "Physical Device", "Responsive Tablet Layout", "Tablet 8.7\" screen renders all tabs, forms, and QR codes cleanly", "Layout verified responsive via framebuffer captures", "PASS"],
        ["SEC-01", "Security", "Audit Trail Traceability", "Multi-role actions logged in append-only AuditLog table", "Full traceability verified across >200 audit entries", "PASS"]
    ]
    add_table(doc, app_c_headers, app_c_data, [Inches(0.7), Inches(0.9), Inches(1.8), Inches(1.7), Inches(1.3), Inches(0.5)])
    
    # Appendix D
    add_h2(doc, "Appendix D: Complete Security & Role-Permission Audit Matrix (41 Checks)")
    add_p(doc, "The table below records all 41 automated security checks executed during the final role-permission penetration audit, verifying 100% compliance:")
    
    app_d_headers = ["Check ID", "Category", "Target Route / Invariant", "Access Boundary Tested", "Measured Result", "Status"]
    app_d_data = [
        ["SEC-01", "Worker Role", "POST /auth/worker/login", "Worker phone + 4-digit PIN authentication", "HTTP 201, JWT issued with role WORKER", "PASS"],
        ["SEC-02", "Worker Role", "POST /workers/me/language", "Scheduled Indian language selection (kok)", "HTTP 200, language persisted in database", "PASS"],
        ["SEC-03", "Worker Role", "POST /records/me/travel", "Ingress GPS coordinates capture at transit node", "HTTP 201, TravelRecord created with fix", "PASS"],
        ["SEC-04", "Worker Role", "POST /travel/leave", "Egress departure log and destination tracking", "HTTP 201, status marked EXITED_GOA", "PASS"],
        ["SEC-05", "Worker Role", "POST /workers/me/household", "Add family dependent scoped to worker identity", "HTTP 201, Spouse registered without overwrite", "PASS"],
        ["SEC-06", "Worker Role", "POST /workers/me/household", "Add roommate with distinct worker identity", "HTTP 201, Independent identity created", "PASS"],
        ["SEC-07", "Worker Role", "POST /records/me/symptom-reports", "Non-diagnostic symptom report + voice memo", "HTTP 201, SymptomReport saved with audio URL", "PASS"],
        ["SEC-08", "Worker Role", "GET /workers/me", "Worker views own permitted profile", "HTTP 200, Own demographic record returned", "PASS"],
        ["SEC-09", "Worker Role", "GET /health-worker/workers/:id", "Worker attempts to read other workers' records", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-10", "Contractor", "GET /contractor/dashboard", "View aggregate workforce stats for assigned sites", "HTTP 200, Statistics scoped to contractor", "PASS"],
        ["SEC-11", "Contractor", "GET /contractor/workers", "Search active roster at contractor's sites", "HTTP 200, Active worker list returned", "PASS"],
        ["SEC-12", "Contractor", "GET /contractor/activity", "View operational workforce movement timeline", "HTTP 200, Timeline retrieved cleanly", "PASS"],
        ["SEC-13", "Contractor", "GET /contractor/alerts", "Operational alert hub with verified PHC phone", "HTTP 200, PHC hotline present in alert", "PASS"],
        ["SEC-14", "Contractor", "GET /contractor/alerts", "Regex audit for clinical symptom terminology", "Regex scan clean: 0 clinical leaks detected", "PASS"],
        ["SEC-15", "Contractor", "GET /contractor/alerts", "Audit for encrypted voice memo URLs or blobs", "Voice URLs strictly omitted from payload", "PASS"],
        ["SEC-16", "Contractor", "POST /records/prescriptions", "Contractor attempts to issue medical prescription", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-17", "Contractor", "GET /contractor/sites/:code", "Contractor Alpha attempts to access Site Beta", "HTTP 403/404 Forbidden (Tenant isolation)", "PASS"],
        ["SEC-18", "Health Worker", "POST /health-worker/active-facility", "Switch active Primary Health Centre binding", "HTTP 200, Bound to Candolim PHC", "PASS"],
        ["SEC-19", "Health Worker", "GET /health-worker/search", "Search surveillance directory in PHC catchment", "HTTP 200, Worker and dependents indexed", "PASS"],
        ["SEC-20", "Health Worker", "POST /health-worker/cases", "Open suspected malaria episode record", "HTTP 201, MalariaEpisode created (SUSPECTED)", "PASS"],
        ["SEC-21", "Health Worker", "POST /health-worker/test-requests", "Queue diagnostic lab referral order", "HTTP 201, Blood smear referral queued", "PASS"],
        ["SEC-22", "Health Worker", "GET /health-worker/follow-ups", "Retrieve scheduled D0-D28 follow-up queue", "HTTP 200, Follow-up queue retrieved", "PASS"],
        ["SEC-23", "Health Worker", "POST /records/prescriptions", "Health Worker attempts independent prescribing", "HTTP 403 Forbidden (Non-Clinician block)", "PASS"],
        ["SEC-24", "Clinician", "POST /records/household-assessments", "Clinical assessment with vital signs examination", "HTTP 201, Temp, BP, pulse persisted", "PASS"],
        ["SEC-25", "Clinician", "POST /records/prescriptions", "Clinician issues authorized ACT/PQ prescription", "HTTP 201, Signed prescription linked to episode", "PASS"],
        ["SEC-26", "Clinician", "GET /admin/overview", "Clinician attempts administrative system actions", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-27", "Pathologist", "POST /records/diagnostics", "Microscopy blood smear evaluation entry", "HTTP 201, P. falciparum confirmed positive", "PASS"],
        ["SEC-28", "Pathologist", "Status Derivation Engine", "Automated status derivation from lab result", "Status derived as POSITIVE strictly from lab", "PASS"],
        ["SEC-29", "Pathologist", "POST /records/prescriptions", "Pathologist attempts to prescribe medication", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-30", "Research Lab", "GET /stakeholders/dashboard", "Access de-identified molecular dashboard", "HTTP 200, Molecular workspace active", "PASS"],
        ["SEC-31", "Research Lab", "POST /records/diagnostics", "Research lab attempts to modify clinical diagnosis", "HTTP 403 Forbidden (Research isolation)", "PASS"],
        ["SEC-32", "Administrator", "GET /facilities", "Institutional facility master registry access", "HTTP 200, Master PHC registry returned", "PASS"],
        ["SEC-33", "Administrator", "POST /admin/users", "Provision new stakeholder account", "HTTP 201, Account provisioned with temp PIN", "PASS"],
        ["SEC-34", "Administrator", "POST /admin/users/:id/deactivate", "Immediate token revocation via JwtStrategy", "HTTP 401 Unauthorized on immediate next request", "PASS"],
        ["SEC-35", "Administrator", "POST /records/prescriptions", "Administrator attempts to prescribe medication", "HTTP 403 Forbidden (Privilege separation)", "PASS"],
        ["SEC-36", "System", "GET /screening/me (as Contractor)", "Direct API attack on worker screening endpoints", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-37", "System", "POST /records/prescriptions (as HW)", "Direct API attack to inject medication order", "HTTP 403 Forbidden (RolesGuard block)", "PASS"],
        ["SEC-38", "System", "Database Mutation Guard", "Verify rejected API calls leave database intact", "Prescription row count unchanged on rejected calls", "PASS"],
        ["SEC-39", "System", "Role Enum Conformance", "Audit user roles against Prisma Role enum", "100% of accounts map to 1 of 7 approved roles", "PASS"],
        ["SEC-40", "System", "Single Active Assignment", "SQL invariant: <= 1 active site assignment/worker", "0 multi-assignment violations detected", "PASS"],
        ["SEC-41", "System", "Audit Trail Retention", "Append-only AuditLog table audit", ">200 immutable audit entries verified", "PASS"]
    ]
    add_table(doc, app_d_headers, app_d_data, [Inches(0.7), Inches(0.9), Inches(1.8), Inches(1.7), Inches(1.4), Inches(0.5)])
    
    # Appendix E
    add_h2(doc, "Appendix E: High-Resolution Architecture & Workflow Schematics")
    add_p(doc, "The six architectural and workflow schematics below provide comprehensive technical blueprints of the platform:")
    
    app_e_schematics = [
        ("Schematic E-1: System Topology & Monorepo Interactions",
         "+-----------------------------------------------------------------------------------------+\n"
         "|                              PACKAGES / SHARED (DOMAIN CORE)                            |\n"
         "|  - Zod Schemas | Domain Enums | Roles | 5-Section Questionnaire | Transfer State Machine |\n"
         "+-----------------------------------------------------------------------------------------+\n"
         "          ^                                   ^                                  ^\n"
         "          | TypeScript Contracts              | TypeScript Contracts             | TypeScript Contracts\n"
         "          v                                   v                                  v\n"
         "+-----------------------+         +-----------------------+          +-----------------------+\n"
         "|  @m3/mobile (Android) |         |   @m3/web (Web SPA)   |          |   @m3/api (NestJS)    |\n"
         "|  - Expo RN 0.76       |         |   - React 18 / Vite   |          |   - Controllers / Svc |\n"
         "|  - Expo SQLite & ORM  |         |   - Role Dashboards   |          |   - JWT / RolesGuard  |\n"
         "|  - Outbox Sync Queue  |         |   - Tailwind CSS      |          |   - Prisma ORM 5.x    |\n"
         "+-----------------------+         +-----------------------+          +-----------------------+\n"
         "          |                                   |                                  |\n"
         "          +-----------------+   +-------------+                                  v\n"
         "                            |   | HTTPS / TLS 1.3                   +------------------------+\n"
         "                            v   v                                   | PostgreSQL 16 Database |\n"
         "                    +-----------------------+                       | - Authoritative Store  |\n"
         "                    | Nginx Edge Proxy (443)| --------------------> | - Partial Indexes      |\n"
         "                    +-----------------------+                       | - SELECT FOR UPDATE    |\n"
         "                                                                    +------------------------+"),
         
        ("Schematic E-2: End-to-End Worker Journey & Registration Gate",
         "[ Launch Mobile App ] --> [ Select Language (14 Scheduled Languages) ]\n"
         "                                     |\n"
         "                                     v\n"
         "                 [ Worker Sign-In / Register (Phone + PIN) ]\n"
         "                                     |\n"
         "                                     v\n"
         "                    [ Check Baseline Screening Status ]\n"
         "                                     |\n"
         "                 +-------------------+-------------------+\n"
         "                 | Incomplete                            | Complete\n"
         "                 v                                       v\n"
         "     [ Initial Screening Gate ]               [ Worker Operational Dashboard ]\n"
         "     - Section I: Socio-Demographic           - Ingress / Egress Travel Tracking\n"
         "     - Section II: Past Malaria History       - Report Unwell (Symptom Checklist)\n"
         "     - Section III: Current Symptoms          - Dynamic 5-Minute Worker QR Pass\n"
         "     - Section IV: Travel Mobility            - Family & Roommate Registration\n"
         "     - Section V: Informed Consent            - Inter-Site Transfer Management\n"
         "                 |\n"
         "                 v\n"
         "     [ Submit & Lock Permanently ]\n"
         "     (HTTP 409 on re-submission)"),
         
        ("Schematic E-3: Offline-First Synchronization & Outbox Engine",
         "[ Field Mobile Action (e.g. Report Symptoms) ]\n"
         "                     |\n"
         "           [ Check Network Signal ]\n"
         "                     |\n"
         "         +-----------+-----------+\n"
         "         | Offline               | Online\n"
         "         v                       v\n"
         "  [ Write to SQLite ]     [ Attempt Primary LAN Ingress (Port 8003) ]\n"
         "  - Table: symptom_report                |\n"
         "  - Table: outbox                        +-------------------+\n"
         "  - Assign UUID key                      | Success           | Timeout / Drop\n"
         "  - Status = PENDING                     v                   v\n"
         "         |                        [ Mark SYNCED ]     [ Fallback to USB Reverse Proxy ]\n"
         "         v                                                   |\n"
         "  [ Network Restored ]                                +------+------+\n"
         "         |                                            |             |\n"
         "         v                                            v Success     v Failure\n"
         "  [ Replay Outbox Queue (POST /screening/symptoms) ] [ SYNCED ]  [ Write to SQLite Outbox ]\n"
         "         |\n"
         "         v\n"
         "  [ Backend Idempotency Validation ]\n"
         "  - Key exists? Return cached 200 OK (0 duplicates)\n"
         "  - New key? Insert record & return 201 Created"),
         
        ("Schematic E-4: Multi-Party Site Transfer State Machine",
         "Worker-Initiated Handshake:\n"
         "[ Worker Submits Transfer Request ] ---> [ Destination Contractor Approves ] ---> [ Current Contractor Releases ]\n"
         "                                                                                            |\n"
         "Contractor-Initiated Handshake:                                                             |\n"
         "[ Dest Contractor Pull Request ]   ---> [ Worker Accepts on Mobile App ]    ---> [ Current Contractor Releases ]\n"
         "                                                                                            |\n"
         "                                                                                            v\n"
         "                                                                        [ Transactional Consensus: ACCEPTED ]\n"
         "                                                                        - Lock row: SELECT ... FOR UPDATE\n"
         "                                                                        - Deactivate Old Assignment\n"
         "                                                                        - Activate New Assignment\n"
         "                                                                        - Write AuditLog Record"),
         
        ("Schematic E-5: Clinical Safety & Diagnostic Separation Boundary",
         "[ Worker Symptom Self-Reports ]        [ Routine Follow-Up Check-Ins ]\n"
         "               |                                      |\n"
         "               +------------------+-------------------+\n"
         "                                  |\n"
         "                                  v\n"
         "                  +-------------------------------+ \n"
         "                  |   OBSERVATIONAL TRIAGE TIER   |\n"
         "                  | (Non-diagnostic, observational|\n"
         "                  +-------------------------------+ \n"
         "                                  |\n"
         "                 ===================================\n"
         "                 STRICT CLINICAL ISOLATION BOUNDARY\n"
         "                 (Malaria status NEVER derived here)\n"
         "                 ===================================\n"
         "                                  |\n"
         "                                  v\n"
         "                  +-------------------------------+ \n"
         "                  |  DIAGNOSTIC & CLINICAL TIER   |\n"
         "                  | - Rapid Diagnostic Tests(RDT) |\n"
         "                  | - Giemsa Blood Smear Micros.  |\n"
         "                  | - Clinician Physical Exam     |\n"
         "                  +-------------------------------+ \n"
         "                                  |\n"
         "                                  v\n"
         "                   [ Derive Infection Status ]\n"
         "                   - POSITIVE / NEGATIVE\n"
         "                   - Authorized Clinician Rx (ACT/PQ)"),
         
        ("Schematic E-6: Database Entity Relationship Diagram (ERD)",
         "+-------------------+       1:1       +-------------------+\n"
         "|       User        | <-------------> |      Worker       |\n"
         "| - id (UUID)       |                 | - id (UUID)       |\n"
         "| - phone (unique)  |                 | - workerCode      |\n"
         "| - role (RoleEnum) |                 | - name, dob, lang |\n"
         "+-------------------+                 +-------------------+\n"
         "                                                | 1:N\n"
         "                                                v\n"
         "+-------------------+       1:N       +-------------------+\n"
         "|  ConstructionSite | <-------------> | WorkerSiteAssign  |\n"
         "| - id (UUID)       |                 | - id (UUID)       |\n"
         "| - siteCode        |                 | - active (bool)   |\n"
         "| - contractorId    |                 | - startedAt       |\n"
         "+-------------------+                 +-------------------+\n"
         "                                                |\n"
         "          +-------------------------------------+-------------------------------------+\n"
         "          | 1:N                                 | 1:N                                 | 1:N\n"
         "          v                                     v                                     v\n"
         "+-------------------+                 +-------------------+                 +-------------------+\n"
         "|   TravelRecord    |                 |   SymptomReport   |                 |   MalariaEpisode  |\n"
         "| - type (IN/OUT)   |                 | - symptoms (enum[])|                | - status (SUSP...)|\n"
         "| - latitude, long. |                 | - voiceMemoUrl    |                 | - facilityId      |\n"
         "+-------------------+                 +-------------------+                 +-------------------+\n"
         "                                                                                      | 1:N\n"
         "                                                                                      v\n"
         "                                                                            +-------------------+\n"
         "                                                                            | DiagnosticResult  |\n"
         "                                                                            | - testType (SMEAR)|\n"
         "                                                                            | - species (FALC..)|\n"
         "                                                                            | - result (POS...) |\n"
         "                                                                            +-------------------+\n"
         "                                                                                      |\n"
         "                                                                                      v\n"
         "                                                                            +-------------------+\n"
         "                                                                            |   Prescription    |\n"
         "                                                                            | - regimen (ACT...)|\n"
         "                                                                            | - clinicianId     |\n"
         "                                                                            +-------------------+")
    ]
    
    for s_title, s_content in app_e_schematics:
        add_h3(doc, s_title)
        add_p(doc, s_content, italic=True)
    
    # Appendix F
    add_h2(doc, "Appendix F: Visual Catalog of Photographic & Device Screenshots")
    add_p(doc, "The following figures provide authentic photographic and screen capture evidence from the staging deployment and physical tablet validation:")
    
    img_dir = "/home/nimr/.gemini/antigravity-cli/brain/eed35bf6-1e2f-4f45-99b1-7e650e94e4b9/screenshots"
    
    # Figure 1: Worker Mobile Portal
    f1_path = os.path.join(img_dir, "staging/staging_01_worker_mobile_portal.png")
    add_image_with_caption(doc, f1_path, "Figure A-1: Worker Mobile Application — Arrival Ingress GPS Capture & Travel Registration (Staging)")
    
    # Figure 2: Contractor Dashboard
    f2_path = os.path.join(img_dir, "staging/staging_02_contractor_dashboard_workforce.png")
    add_image_with_caption(doc, f2_path, "Figure A-2: Contractor Management Portal — Workforce Roster, Site Filtering & Active Workers (Staging)")
    
    # Figure 3: Contractor Alerts & PHC Coordination
    f3_path = os.path.join(img_dir, "staging/staging_03_contractor_alerts_phc_coordination.png")
    add_image_with_caption(doc, f3_path, "Figure A-3: Contractor Alerts Hub — Operational Health Triage & Candolim PHC Emergency Hotline (Zero Medical Data)")
    
    # Figure 4: Site Transfer Handshake
    f4_path = os.path.join(img_dir, "staging/staging_04_contractor_transfers_handshake.png")
    add_image_with_caption(doc, f4_path, "Figure A-4: Site Transfer Management — Inter-Contractor Multi-Party Transfer Handshake & Audit Timeline")
    
    # Figure 5: Health Worker Surveillance Directory
    f5_path = os.path.join(img_dir, "staging/staging_05_health_worker_surveillance_search.png")
    add_image_with_caption(doc, f5_path, "Figure A-5: Health Worker Surveillance Directory — Worker & Household Case Search with Candolim PHC Binding")
    
    # Figure 6: Physical Android Hardware
    f6_path = os.path.join(img_dir, "device/device_consolidated_dashboard.png")
    add_image_with_caption(doc, f6_path, "Figure A-6: Physical Android Tablet Verification — Samsung Galaxy Tab A7 Lite (Android 14) Native Layout")
    
    # Appendix G
    add_h2(doc, "Appendix G: Index of Foundational Source Reports & Evidence Files")
    add_p(doc, "This governance submission cites and builds upon nine primary source reports and architectural artifacts:")
    add_bullet(doc, " National Vector Borne Disease Control Programme (NVBDCP) & ICMR, 'Development of mobile app for real-time capturing and monitoring of malaria cases among migrant labourers in Goa state' (Proposal V6, 2026).")
    add_bullet(doc, " M3 Architecture Team, 'M3 Platform Technical Overview' (m3platform.docx, 2026).")
    add_bullet(doc, " Software Engineering Working Group, 'Work-To-be-Done Specification & Role Dashboard Baseline' (Work-To-be-Done.txt, 2026).")
    add_bullet(doc, " Lead Systems Architect, 'Production Release Manifest — v2.0.0-RC1' (release_v2.0.0-RC1_manifest.md, 2026).")
    add_bullet(doc, " Infrastructure Security Team, 'Production Deployment Readiness & Setup Report — v2.0.0-RC1' (production_deployment_report_v2.0.0-RC1.md, 2026).")
    add_bullet(doc, " Quality Assurance & Testing Lead, 'Comprehensive Field Pilot Acceptance Report — v2.0.0-RC1' (field_pilot_acceptance_report_v2.0.0-RC1.md, 2026).")
    add_bullet(doc, " Security & Compliance Officer, 'Final Role-Permission and Data-Access Audit Report — v2.0.0-RC1' (final_role_permission_and_data_access_audit_v2.0.0-RC1.md, 2026).")
    add_bullet(doc, " Engineering Team, 'Master Architecture, Prompt & Flowcharts' (docs/m3-master-architecture-and-flowcharts.md, 2026).")
    add_bullet(doc, " Clinical Advisory Committee, 'Standard Proforma for Malaria Surveillance in Migrant Labourers' (Questionnaire Updated 1 Sept 2026.docx).")
    
    # Appendix H
    add_h2(doc, "Appendix H: Comprehensive Glossary of Technical & Epidemiological Terms")
    glossary_headers = ["Term / Acronym", "Technical and Epidemiological Definition"]
    glossary_data = [
        ["ACT", "Artemisinin-based Combination Therapy; the frontline therapeutic regimen for Plasmodium falciparum malaria."],
        ["API", "Application Programming Interface; RESTful contract enabling secure data exchange between clients and backend."],
        ["ASHA", "Accredited Social Health Activist; community health worker under the National Health Mission conducting field triage."],
        ["DHS", "Directorate of Health Services; the statutory state healthcare administrative body of the Government of Goa."],
        ["DPDP Act", "Digital Personal Data Protection Act; Indian statutory framework governing digital personal health data handling."],
        ["Gametocyte", "The sexual stage of the malaria parasite present in human blood, responsible for transmission to mosquitoes."],
        ["HSTS", "HTTP Strict Transport Security; header forcing secure HTTPS connections and preventing downgrade attacks."],
        ["Hypnozoite", "The dormant liver-stage parasite in Plasmodium vivax responsible for late clinical relapses unless eradicated."],
        ["JWT", "JSON Web Token; cryptographically signed token utilized for stateless session authentication and role verification."],
        ["Kelch13 (K13)", "Plasmodium falciparum molecular propeller gene marker associated with artemisinin drug resistance."],
        ["NVBDCP", "National Vector Borne Disease Control Programme; central national programme overseeing malaria elimination."],
        ["PfHRP2 / PfHRP3", "Plasmodium falciparum Histidine-Rich Proteins 2 and 3; target antigens for RDTs; gene deletions cause false negatives."],
        ["PHC", "Primary Health Centre; foundational institutional public health facility providing clinical care and microscopy."],
        ["Primaquine", "8-aminoquinoline antimalarial drug administered over 14 days to achieve radical cure of Plasmodium vivax."],
        ["RBAC", "Role-Based Access Control; security mechanism restricting system access strictly to authorized role scopes."],
        ["RDT", "Rapid Diagnostic Test; lateral-flow immunochromatographic cassette detecting circulating malaria antigens."],
        ["RPO", "Recovery Point Objective; the maximum acceptable duration of data loss during disaster recovery (M3 standard: zero)."],
        ["RTO", "Recovery Time Objective; the duration within which systems must be restored following disruption (M3 standard: <5 min)."],
        ["WGS-84", "World Geodetic System 1984; standard coordinate reference frame utilized for global GPS spatial tracking."]
    ]
    add_table(doc, glossary_headers, glossary_data, [Inches(1.8), Inches(5.1)])

print("Sections 8 to 15 module loaded.")
