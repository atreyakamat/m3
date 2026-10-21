-- M3 read-only integrity verification queries (PostgreSQL).
-- Safe on any M3 database: only SELECTs. Run via:
--   docker exec -i m3-pg-test psql -U m3test -d m3_test -f - < scripts/sql/verify_integrity.sql
-- Expectations for a FRESH seeded database (scripts/seed_pg_testdata.py): see comments.

-- A. Reconciliation: each offline attempt (offline request id) maps to EXACTLY ONE patient record
SELECT client_request_id, COUNT(*) AS dupes
FROM patients WHERE client_request_id IS NOT NULL
GROUP BY 1 HAVING COUNT(*) > 1;   -- expect: (0 rows)

-- B. Every idempotent-reconciled Patient carries its creating account (attribution)
SELECT p.id, p.client_request_id, u.id AS created_by
FROM patients p LEFT JOIN users u ON u.id = p.created_by_user_id
WHERE p.client_request_id IS NOT NULL;  -- expect: each row has non-null created_by

-- C. ForeignKey integrity sweep across the high-traffic relations
SELECT 'sample->patient broken' AS check_name, COUNT(*) FROM samples s LEFT JOIN patients p ON p.id = s.patient_id WHERE p.id IS NULL
UNION ALL SELECT 'assessment->patient broken', COUNT(*) FROM clinical_assessments a LEFT JOIN patients p ON p.id = a.patient_id WHERE p.id IS NULL
UNION ALL SELECT 'test->sample broken', COUNT(*) FROM diagnostic_tests t LEFT JOIN samples s ON s.id = t.sample_id WHERE s.id IS NULL
UNION ALL SELECT 'followup->patient broken', COUNT(*) FROM follow_ups f LEFT JOIN patients p ON p.id = f.patient_id WHERE p.id IS NULL
UNION ALL SELECT 'molecular->sample broken', COUNT(*) FROM molecular_results m LEFT JOIN samples s ON s.id = m.sample_id WHERE s.id IS NULL
UNION ALL SELECT 'slide->sample broken', COUNT(*) FROM slide_follow_ups sl LEFT JOIN samples s ON s.id = sl.sample_id WHERE s.id IS NULL
UNION ALL SELECT 'assignment broken', COUNT(*) FROM worker_site_assignments wsa LEFT JOIN patients p ON p.id = wsa.patient_id LEFT JOIN sites st ON st.id = wsa.site_id WHERE p.id IS NULL OR st.id IS NULL;  -- expect: every count 0

-- D. Contact network invariants: no role user is also a patient-tracked worker
SELECT u.id FROM users u JOIN patients p ON p.id = u.id
JOIN role_assignments r ON r.user_id = u.id
WHERE r.role <> 'worker'; -- expect: (0 rows)

-- E. Enum/vocabulary violations (must be zero per backend schemas.py)
SELECT 'bad species' AS check_name, COUNT(*) FROM diagnostic_tests WHERE species IS NOT NULL AND species NOT IN ('pf','pv','mixed','other','undetermined')
UNION ALL SELECT 'bad test result', COUNT(*) FROM diagnostic_tests WHERE result_status NOT IN ('pending','positive','negative','indeterminate','cancelled')
UNION ALL SELECT 'bad method', COUNT(*) FROM diagnostic_tests WHERE method NOT IN ('rdt','microscopy','smp','other')
UNION ALL SELECT 'bad research status', COUNT(*) FROM molecular_results WHERE pcr_status IS NOT NULL AND pcr_status NOT IN ('not_tested','pending','inconclusive','detected','not_detected');

-- F. Category counts for the release report (paste output into the matrix)
SELECT 'patients total' AS metric, COUNT(*) AS n FROM patients
UNION ALL SELECT 'with full questionnaire', COUNT(*) FROM questionnaire_submissions WHERE state = 'submitted'
UNION ALL SELECT 'drafts preserved', COUNT(*) FROM questionnaire_submissions WHERE state = 'draft'
UNION ALL SELECT 'positive slides', COUNT(*) FROM diagnostic_tests WHERE result_status = 'positive'
UNION ALL SELECT 'species mixes', COUNT(*) FROM diagnostic_tests WHERE species = 'mixed'
UNION ALL SELECT 'followups completed', COUNT(*) FROM follow_ups WHERE status = 'completed'
UNION ALL SELECT 'followups missed', COUNT(*) FROM follow_ups WHERE status = 'missed'
UNION ALL SELECT 'clinical admitted', COUNT(*) FROM clinical_assessments WHERE admission_status = 'admitted'
UNION ALL SELECT 'treatment incomplete (reason documented)', COUNT(DISTINCT c.id) FROM clinical_assessments c WHERE c.treatment_incomplete_reason IS NOT NULL
UNION ALL SELECT 'molecular detected', COUNT(*) FROM molecular_results WHERE pcr_status = 'detected';

-- G. Audit trail coherence: every mutation route audited
SELECT action, COUNT(*) FROM audit_events GROUP BY action ORDER BY 2 DESC;
-- Post-logout check explicitly:
SELECT 'logout events' AS check_name, COUNT(*) FROM audit_events WHERE action = 'auth.logout';  -- >= 1 after kit run
