/** Worker record — ported from legacy WorkerDrawer; identical data contract. */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api";
import {
  Badge, Banner, Button, Card, EmptyState, ErrorState, IconButton, Section, Skeleton, Tabs,
} from "../ui/components";
import {
  ClinicalAssessmentModal, ContractorEnrollModal, ContractorStatusModal,
  PathologistSampleModal, ScheduleFollowupModal, SlideFollowupModal,
} from "./modals";
import type {
  ClinicalAssessmentItem, DiagnosticSampleItem, FollowUpItem, QuestionnaireItem, WorkerDetail,
} from "../types";
import { useSession } from "../lib/session";
import { isPathologist, isReadOnlyRole } from "../lib/roles";

type WorkerTab = "overview" | "screening" | "clinical" | "diagnostics" | "followups" | "travel";

/* ------------------------------------------------------------- formatting */
/** Same date formatting as the legacy drawer (toLocaleString / toLocaleDateString). */
function fmtDateTime(s?: string): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function fmtDate(s?: string): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}
function upper(s?: string): string {
  return s ? s.toUpperCase() : "—";
}

/* --------------------------------------------------------------- helpers */
function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "var(--r-md)",
      padding: "10px 12px", background: "var(--bg-surface)", minWidth: 0,
    }}>
      <div style={{
        fontSize: "var(--fs-xs)", fontWeight: 700, letterSpacing: "0.05em",
        textTransform: "uppercase", color: "var(--text-3)",
      }}>{k}</div>
      <div style={{ marginTop: 4, fontWeight: 600, overflowWrap: "anywhere" }}>{v ?? "—"}</div>
    </div>
  );
}

const kvGridStyle: CSSProperties = {
  display: "grid", gap: "var(--sp-3)",
  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
};

/* -------------------------------------------------------------- component */
export function WorkerRecord({ workerId, onClose, onRefresh }:
  { workerId: string; onClose: () => void; onRefresh: () => void }) {
  const { session } = useSession();
  const token = session?.access_token;

  const [detail, setDetail] = useState<WorkerDetail | null>(null);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireItem[]>([]);
  const [assessments, setAssessments] = useState<ClinicalAssessmentItem[]>([]);
  const [samples, setSamples] = useState<DiagnosticSampleItem[]>([]);
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [activeTab, setActiveTab] = useState<WorkerTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Role-gated action modals (same gating as the legacy action toolbar).
  const [modal, setModal] = useState<
    { kind: "assessment" } | { kind: "followup" } | { kind: "sample" } |
    { kind: "slide"; sample: DiagnosticSampleItem } | { kind: "enroll" } | { kind: "status" } | null
  >(null);

  // Roles — business logic verbatim from the legacy drawer; the "pathology"
  // legacy id is tolerated via isPathologist from lib/roles.
  const roles = session?.user.roles ?? [];
  const isClinician = roles.includes("clinician");
  const isPath = roles.some(isPathologist);
  const isContractor = roles.includes("contractor");
  const isReadOnly =
    roles.some((r) => isReadOnlyRole(r)) && !isClinician && !isPath && !isContractor;

  async function loadWorker() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      // 1. Worker profile
      const w = await api<WorkerDetail>(`/workers/${workerId}`, token);
      setDetail(w);

      // 2. Questionnaires
      try {
        const qRes = await api<{ items: QuestionnaireItem[] }>(`/questionnaires?patient_id=${workerId}`, token);
        setQuestionnaires(qRes?.items || []);
      } catch {
        setQuestionnaires([]);
      }

      // 3. Clinical assessments (clinician or admin)
      if (isClinician || roles.includes("admin")) {
        try {
          const aRes = await api<{ items: ClinicalAssessmentItem[] }>(`/assessments?patient_id=${workerId}`, token);
          setAssessments(aRes?.items || []);
        } catch {
          setAssessments([]);
        }
      }

      // 4. Samples for this worker
      try {
        const sRes = await api<{ items: DiagnosticSampleItem[] }>("/samples?limit=100", token);
        const mySamples = (sRes?.items || []).filter((s) => s.patient_id === workerId);
        setSamples(mySamples);
      } catch {
        setSamples([]);
      }

      // 5. Follow-ups for this worker
      try {
        const fRes = await api<{ items: FollowUpItem[] }>(`/follow-ups?patient_id=${workerId}`, token);
        setFollowups(fRes?.items || []);
      } catch {
        setFollowups([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load worker profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, token]);

  // Esc closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const canClinical = isClinician || roles.includes("admin");
  const title = detail?.patient_code || workerId;

  const tabs: Array<{ id: WorkerTab; label: string; badge?: ReactNode }> = [
    { id: "overview", label: "Overview" },
    { id: "screening", label: "Questionnaires", badge: questionnaires.length },
    ...(canClinical ? [{ id: "clinical" as WorkerTab, label: "Clinical", badge: assessments.length }] : []),
    { id: "diagnostics", label: "Diagnostics", badge: samples.length },
    { id: "followups", label: "Follow-ups", badge: followups.length },
    { id: "travel", label: "Travel", badge: detail?.travel_history?.length || 0 },
  ];

  return (
    <div
      className="m3-overlay"
      style={{ placeItems: "stretch end" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside
        className="m3-drawer-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Worker record ${title}`}
      >
        {/* ------------------------------------------------------- header */}
        <header style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: "var(--sp-3)", padding: "var(--sp-4) var(--sp-5)",
          borderBottom: "1px solid var(--border)", background: "var(--bg-surface-2)",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: "var(--fs-xs)", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--text-3)",
            }}>Worker surveillance profile</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--fs-2xl)", fontWeight: 800, overflowWrap: "anywhere" }}>{title}</h2>
              <Badge tone={detail?.consent_status === "documented" ? "ok" : "warn"}>
                {detail?.consent_status === "documented" ? "Consent Documented" : "Consent Pending"}
              </Badge>
            </div>
            <span style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
              {detail?.display_name || "Pseudonymized / De-identified Record"} ·{" "}
              {detail?.age_years ? `${detail.age_years} yrs` : "Age Unspecified"} ·{" "}
              {detail?.gender ? detail.gender.toUpperCase() : "Gender Unspecified"}
            </span>
          </div>
          <IconButton label="Close worker record" onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </IconButton>
        </header>

        {/* --------------------------------------------------- read-only */}
        {isReadOnly && (
          <div style={{ padding: "var(--sp-3) var(--sp-5) 0" }}>
            <Banner tone="info">Read-only: your role cannot modify this record.</Banner>
          </div>
        )}

        {/* ------------------------------------------------- actions bar */}
        {!isReadOnly && detail && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 8,
            padding: "0 var(--sp-5) var(--sp-3)",
          }}>
            {isClinician && (
              <Button size="sm" onClick={() => setModal({ kind: "assessment" })}>+ Record Assessment</Button>)}
            {isClinician && (
              <Button size="sm" variant="subtle" onClick={() => setModal({ kind: "followup" })}>+ Schedule Follow-up</Button>)}
            {isPath && (
              <Button size="sm" variant="subtle" onClick={() => setModal({ kind: "sample" })}>+ Record Diagnostic Sample</Button>)}
            {isContractor && (
              <Button size="sm" variant="secondary" onClick={() => setModal({ kind: "enroll" })}>+ Enroll at Site</Button>)}
            {isContractor && (
              <Button size="sm" variant="secondary" onClick={() => setModal({ kind: "status" })}>+ Update Health Status</Button>)}
          </div>
        )}

        {/* -------------------------------------------------------- tabs */}
        <nav style={{ padding: "var(--sp-3) var(--sp-5) 0", borderBottom: "1px solid var(--border)" }}>
          <Tabs tabs={tabs} value={activeTab} onChange={(id) => setActiveTab(id as WorkerTab)} />
        </nav>

        {/* -------------------------------------------------------- body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--sp-5)" }}>
          {loading ? (
            <div role="status" aria-busy="true" aria-label="Loading worker surveillance record...">
              <p className="m3-hint" style={{ marginBottom: "var(--sp-3)" }}>Loading worker surveillance record...</p>
              <Skeleton card />
              <Skeleton card />
              <Skeleton lines={6} />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadWorker} />
          ) : activeTab === "overview" ? (
            <>
              <Section title="Demographics & Identity">
                <div style={kvGridStyle}>
                  <KV k="Patient Code" v={detail?.patient_code} />
                  <KV k="Full Name" v={detail?.display_name || "De-identified"} />
                  <KV k="Calculated Age" v={<>
                    {detail?.age_years ? `${detail.age_years} years` : "Unspecified"}
                    {detail?.dob ? ` (DOB: ${detail.dob})` : ""}
                  </>} />
                  <KV k="Gender" v={detail?.gender ? detail.gender.toUpperCase() : "—"} />
                  <KV k="Mobile Number" v={detail?.phone_e164 || "Restricted / Not documented"} />
                  <KV k="Preferred Language" v={detail?.preferred_language || "hindi"} />
                  <KV k="Present Address (Goa)" v={detail?.address_present || "—"} />
                  <KV k="Permanent Address" v={detail?.address_permanent || "—"} />
                </div>
              </Section>

              <Section title="Site Memberships & Contractor Status">
                {detail?.site_assignments?.length ? (
                  <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                    {detail.site_assignments.map((a, idx) => (
                      <Card key={idx} title={a.site_name} subtitle={`Started: ${a.start_date}`}>
                        <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", fontSize: "var(--fs-sm)" }}>
                          <span>Reported Malaria: <strong>{a.reported_malaria_status || "None reported"}</strong></span>
                          <span>Treatment: <strong>{a.reported_treatment_status || "None reported"}</strong></span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                    No active site assignments documented.
                  </p>
                )}
              </Section>
            </>
          ) : activeTab === "screening" ? (
            questionnaires.length ? (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {questionnaires.map((q) => (
                  <Card key={q.id}
                    title={`Submission ${q.id.slice(0, 8)}`}
                    subtitle={`Version: ${q.schema_version} · State: ${q.state.toUpperCase()}`}
                    actions={<span style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                      {q.submitted_at ? fmtDateTime(q.submitted_at) : "Draft"}
                    </span>}>
                    {q.data ? (
                      <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                        <div>
                          <div className="m3-hint" style={{ fontWeight: 700 }}>Section 1: Personal &amp; Demographics</div>
                          <div style={kvGridStyle}>
                            <KV k="Name" v={q.data.personal?.full_name || "—"} />
                            <KV k="DOB" v={q.data.personal?.dob || "—"} />
                            <KV k="Mobile" v={q.data.personal?.mobile || "—"} />
                            <KV k="Address" v={q.data.personal?.address_present || "—"} />
                          </div>
                        </div>
                        <div>
                          <div className="m3-hint" style={{ fontWeight: 700 }}>Section 2: Past Malaria History</div>
                          <div style={kvGridStyle}>
                            <KV k="Diagnosed Malaria" v={q.data.past_history?.diagnosed_malaria || "no"} />
                            {q.data.past_history?.diagnosed_malaria === "yes" && (
                              <>
                                <KV k="Year" v={q.data.past_history?.diagnosis_year || "—"} />
                                <KV k="Hospitalized" v={q.data.past_history?.hospitalized || "—"} />
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="m3-hint" style={{ fontWeight: 700 }}>Section 3: Present Clinical Symptoms</div>
                          <div style={kvGridStyle}>
                            <KV k="Fever Today" v={q.data.present_clinical?.fever_today || "no"} />
                            <KV k="Duration" v={q.data.present_clinical?.fever_duration || "—"} />
                            <KV k="Temperature" v={q.data.present_clinical?.temperature_c ? `${q.data.present_clinical.temperature_c}°C` : "—"} />
                            <KV k="Symptoms" v={q.data.present_clinical?.symptoms?.join(", ") || "None"} />
                            <KV k="Can Attend Testing" v={q.data.present_clinical?.can_attend_testing || "yes"} />
                          </div>
                        </div>
                        <div>
                          <div className="m3-hint" style={{ fontWeight: 700 }}>Section 4: Migration &amp; Residence History</div>
                          <div style={kvGridStyle}>
                            <KV k="Time in Goa" v={q.data.migration_history?.time_in_goa || "—"} />
                            <KV k="Outside Goa in last 3m" v={q.data.migration_history?.outside_goa_3m || "no"} />
                          </div>
                        </div>
                        <div>
                          <div className="m3-hint" style={{ fontWeight: 700 }}>Section 5: Planned Travel</div>
                          <div style={kvGridStyle}>
                            <KV k="Planning travel outside Goa" v={q.data.planned_travel?.planning || "no"} />
                            {q.data.planned_travel?.planning === "yes" && (
                              <KV k="Destination" v={q.data.planned_travel?.destination_state || "—"} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="m3-hint">Questionnaire content restricted for this role view.</p>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No screening questionnaires"
                message="No screening questionnaires submitted for this worker." />
            )
          ) : activeTab === "clinical" && canClinical ? (
            assessments.length ? (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {assessments.map((a) => (
                  <Card key={a.id}
                    title={`Encounter with ${a.medical_officer_name || "Medical Officer"}`}
                    subtitle={fmtDateTime(a.encounter_at)}
                    actions={<Badge tone={a.admission_status === "admitted" ? "warn" : "neutral"}>
                      {upper(a.admission_status) || "OUTPATIENT"}
                    </Badge>}>
                    <div style={kvGridStyle}>
                      <KV k="Temp" v={a.temperature_c ? `${a.temperature_c}°C` : "—"} />
                      <KV k="Fever Duration" v={a.fever_duration_category || "—"} />
                      <KV k="Severity" v={upper(a.admission_severity)} />
                      <KV k="Species" v={upper(a.admission_species)} />
                      <KV k="Treatment Completed" v={upper(a.treatment_completed)} />
                    </div>
                    {a.treatment_documentation && (
                      <p style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-sm)" }}>
                        <span style={{ color: "var(--text-2)" }}>Documented Care Plan: </span>
                        <strong>{a.treatment_documentation}</strong>
                      </p>
                    )}
                    {a.notes && (
                      <p className="m3-hint" style={{ marginTop: "var(--sp-2)" }}>Remarks: {a.notes}</p>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No clinical encounters"
                message="No clinical encounters documented for this worker." />
            )
          ) : activeTab === "diagnostics" ? (
            samples.length ? (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {samples.map((s) => (
                  <Card key={s.id}
                    title={`Sample Code: ${s.sample_code}`}
                    subtitle={`(${s.specimen_type})`}
                    actions={<Badge
                      tone={s.status === "positive" ? "danger" : s.status === "negative" ? "ok" : "warn"}>
                      {upper(s.status)}
                    </Badge>}>
                    {s.tests?.length ? (
                      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                        {s.tests.map((t) => (
                          <div key={t.id} style={{
                            display: "flex", gap: "var(--sp-4)", flexWrap: "wrap",
                            fontSize: "var(--fs-sm)",
                          }}>
                            <span>Method: <strong>{upper(t.method)}</strong></span>
                            <span>Species: <strong>{upper(t.species)}</strong></span>
                            <span>Smear: <strong>{t.smear_type || "—"}</strong></span>
                            {t.notes && <span style={{ color: "var(--text-2)" }}>Notes: {t.notes}</span>}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Longitudinal Slide Follow-up */}
                    <div style={{
                      marginTop: "var(--sp-3)", border: "1px dashed var(--border)",
                      borderRadius: "var(--r-md)", padding: "10px 12px", background: "var(--bg-surface-2)",
                    }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 700 }}>Longitudinal Slide Follow-up</div>
                      {s.slide_follow_up ? (
                        <div style={{
                          display: "flex", gap: "var(--sp-4)", flexWrap: "wrap",
                          marginTop: 6, fontSize: "var(--fs-sm)",
                        }}>
                          <span>Scheduled: <strong>{s.slide_follow_up.scheduled_day}</strong></span>
                          <span>Received: <strong>{upper(s.slide_follow_up.received)}</strong></span>
                          {s.slide_follow_up.received === "yes" ? (
                            <span>Positivity: <strong>{upper(s.slide_follow_up.positive)}</strong></span>
                          ) : (
                            <span>Reason: <strong>{s.slide_follow_up.not_received_reason} ({s.slide_follow_up.other_reason || ""})</strong></span>
                          )}
                        </div>
                      ) : (
                        <p className="m3-hint" style={{ marginTop: 6 }}>No follow-up slide recorded yet.</p>
                      )}
                    </div>
                    {isPath && s.status === "positive" && (
                      <div style={{ marginTop: "var(--sp-3)" }}>
                        <Button size="sm" variant="subtle"
                          onClick={() => setModal({ kind: "slide", sample: s })}
                          aria-label={`Record slide follow-up for sample ${s.sample_code}`}>
                          + Record Slide Follow-up
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No diagnostic samples"
                message="No pathology or diagnostic samples on record for this worker.">
                {isPath ? (
                  <Button size="sm" onClick={() => setModal({ kind: "sample" })}>+ Record Diagnostic Sample</Button>
                ) : null}
              </EmptyState>
            )
          ) : activeTab === "followups" ? (
            followups.length ? (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {followups.map((f) => (
                  <Card key={f.id}
                    title={f.scheduled_day || "Follow-up Encounter"}
                    subtitle={`Due: ${fmtDate(f.due_at)}`}
                    actions={<Badge tone={f.status === "completed" ? "ok" : "neutral"}>
                      {upper(f.status) || "DUE"}
                    </Badge>}>
                    <div style={{
                      display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", fontSize: "var(--fs-sm)",
                    }}>
                      <span>Adherence: <strong>{f.adherence || "Pending evaluation"}</strong></span>
                      <span>Outcome: <strong>{f.outcome || "Pending evaluation"}</strong></span>
                    </div>
                    {f.notes && <p className="m3-hint" style={{ marginTop: "var(--sp-2)" }}>Notes: {f.notes}</p>}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No follow-up visits"
                message="No scheduled follow-up visits recorded for this worker." />
            )
          ) : activeTab === "travel" ? (
            detail?.travel_history?.length ? (
              <div style={{ display: "grid", gap: "var(--sp-3)" }}>
                {detail.travel_history.map((t, idx) => (
                  <Card key={idx} title={`${t.origin} → ${t.destination}`}>
                    <div style={{
                      display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", alignItems: "center",
                      color: "var(--text-2)", fontSize: "var(--fs-sm)",
                    }}>
                      <span>Arrival: {t.arrival_date || "—"}</span>
                      <span>Departure: {t.departure_date || "—"}</span>
                      <span>Return: {t.return_date || "—"}</span>
                      {t.planned && <Badge tone="info" dot={false}>Planned Travel</Badge>}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No travel history"
                message="No external travel history documented." />
            )
          ) : null}
        </div>

        {/* ------------------------------------------------- role-gated modals */}
        {token && detail && modal?.kind === "assessment" && (
          <ClinicalAssessmentModal worker={detail} token={token} onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
        {token && detail && modal?.kind === "followup" && (
          <ScheduleFollowupModal worker={detail} token={token} onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
        {token && detail && modal?.kind === "sample" && (
          <PathologistSampleModal worker={detail} token={token} onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
        {token && detail && modal?.kind === "enroll" && (
          <ContractorEnrollModal worker={detail} token={token} onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
        {token && detail && modal?.kind === "status" && (
          <ContractorStatusModal worker={detail} token={token} onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
        {token && modal?.kind === "slide" && (
          <SlideFollowupModal sampleId={modal.sample.id} sampleCode={modal.sample.sample_code} token={token}
            onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); loadWorker(); onRefresh(); }} />)}
      </aside>
    </div>
  );
}
