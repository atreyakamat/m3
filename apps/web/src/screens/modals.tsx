/** Action modals — ported from the previous main.tsx. All business logic and
 *  JSON payload contracts with the backend (POST /assessments,
 *  POST /follow-ups, POST /samples, PUT /samples/{id}/slide-followup,
 *  POST /workers/{id}/membership, PUT /workers/{id}/reported-status) are
 *  preserved verbatim; presentation now uses the M3 design system. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import {
  Button, Field, FormGrid, Input, Modal, Select, TextArea, Toggle,
} from "../ui/components";
import type { HealthWorkerItem, SiteItem, WorkerDetail } from "../types";

/* ----------------------------------------------- Clinician: Assessment */
export function ClinicalAssessmentModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [temp, setTemp] = useState("38.2");
  const [feverDays, setFeverDays] = useState("2");
  const [feverCat, setFeverCat] = useState("1_3_days");
  const [officerName, setOfficerName] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>(["fever", "chills"]);
  const [admissionStatus, setAdmissionStatus] = useState("admitted");
  const [admissionSeverity, setAdmissionSeverity] = useState("mild");
  const [admissionSpecies, setAdmissionSpecies] = useState("pv");
  const [treatmentCompleted, setTreatmentCompleted] = useState("yes");
  const [treatmentReason, setTreatmentReason] = useState("");
  const [treatmentDoc, setTreatmentDoc] = useState("Standard oral chloroquine protocol initiated");
  const [notes, setNotes] = useState("Clinical evaluation completed at primary health centre");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const symptomOptions = ["fever", "chills", "headache", "nausea", "vomiting", "body_ache", "fatigue"];

  function toggleSymptom(sym: string) {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/assessments", token, {
        method: "POST",
        body: JSON.stringify({
          patient_id: worker.id,
          medical_officer_name: officerName,
          temperature_c: parseFloat(temp) || 37.0,
          fever_duration_days: parseInt(feverDays) || 1,
          fever_duration_category: feverCat,
          symptoms,
          admission_status: admissionStatus,
          admission_severity: admissionStatus === "admitted" ? admissionSeverity : undefined,
          admission_species: admissionSpecies || undefined,
          treatment_completed: treatmentCompleted,
          treatment_incomplete_reason: treatmentCompleted === "no" ? treatmentReason : undefined,
          treatment_documentation: treatmentDoc,
          notes,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record assessment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Record Clinical Assessment" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="assess-form" loading={loading}>Submit Assessment</Button>
      </>}>
      <form id="assess-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>CLINICAL ENCOUNTER · Patient: {worker.patient_code} ({worker.display_name || "De-identified"})</p>

        <FormGrid>
          <Field label="Medical Officer Name" required>
            <Input type="text" value={officerName} onChange={(e) => setOfficerName(e.target.value)}
              placeholder="Full name of the medical officer" required />
          </Field>

          <Field label="Temperature (°C)" required>
            <Input type="number" step="0.1" min={35} max={43} value={temp}
              onChange={(e) => setTemp(e.target.value)} required />
          </Field>

          <Field label="Fever Duration">
            <Select value={feverCat} onChange={(e) => setFeverCat(e.target.value)}>
              <option value="<24h">&lt; 24 hours</option>
              <option value="1_3_days">1 to 3 days</option>
              <option value="4_7_days">4 to 7 days</option>
              <option value=">7_days">&gt; 7 days</option>
            </Select>
          </Field>

          <Field label="Admission Status">
            <Select value={admissionStatus} onChange={(e) => setAdmissionStatus(e.target.value)}>
              <option value="outpatient">Outpatient</option>
              <option value="admitted">Admitted</option>
              <option value="referred">Referred</option>
            </Select>
          </Field>
        </FormGrid>

        {admissionStatus === "admitted" ? (
          <FormGrid>
            <Field label="Admission Severity (Required for Admitted)">
              <Select value={admissionSeverity} onChange={(e) => setAdmissionSeverity(e.target.value)}>
                <option value="mild">Mild</option>
                <option value="severe">Severe</option>
              </Select>
            </Field>

            <Field label="Suspected / Clinical Species">
              <Select value={admissionSpecies} onChange={(e) => setAdmissionSpecies(e.target.value)}>
                <option value="pv">Plasmodium vivax (Pv)</option>
                <option value="pf">Plasmodium falciparum (Pf)</option>
                <option value="mixed">Mixed (Pv + Pf)</option>
                <option value="unconfirmed">Unconfirmed</option>
              </Select>
            </Field>
          </FormGrid>
        ) : null}

        <Field label="Presenting Symptoms">
          <div role="group" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
            {symptomOptions.map((sym) => (
              <Toggle key={sym} label={sym.replace("_", " ")}
                checked={symptoms.includes(sym)} onChange={() => toggleSymptom(sym)} />
            ))}
          </div>
        </Field>

        <FormGrid>
          <Field label="Treatment Completed">
            <Select value={treatmentCompleted} onChange={(e) => setTreatmentCompleted(e.target.value)}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_applicable">Not Applicable</option>
            </Select>
          </Field>

          {treatmentCompleted === "no" ? (
            <Field label="Incomplete Reason (Required)" required>
              <Input type="text" value={treatmentReason} onChange={(e) => setTreatmentReason(e.target.value)}
                placeholder="e.g., Patient vomited medication / lost to follow-up" required />
            </Field>
          ) : null}
        </FormGrid>

        <Field label="Treatment Documentation (Prescribed Regimen)">
          <Input type="text" value={treatmentDoc} onChange={(e) => setTreatmentDoc(e.target.value)} />
        </Field>

        <Field label="Clinical Remarks &amp; Notes">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* --------------------------------------- Clinician: Schedule Follow-up */
export function ScheduleFollowupModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [healthWorkers, setHealthWorkers] = useState<HealthWorkerItem[]>([]);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [scheduledDay, setScheduledDay] = useState("Day 3");
  const [dueDaysAhead, setDueDaysAhead] = useState("3");
  const [notes, setNotes] = useState("Check chloroquine compliance, fever resolution, and adverse symptoms");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Entity idempotency key for POST /follow-ups (defect D2). Minted at the
  // first submit of this logical task. A failed submit keeps the key so a
  // retry resolves to the same task; a confirmed create closes the modal and
  // unmounts the ref, so the next task mints a fresh key.
  const requestIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    async function fetchHW() {
      try {
        const res = await api<{ items: HealthWorkerItem[] }>("/health-workers", token);
        if (res?.items?.length) {
          setHealthWorkers(res.items);
          setAssignedUserId(res.items[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load active health workers");
      }
    }
    void fetchHW();
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!assignedUserId) {
      setError("Please select an active health worker");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const days = parseInt(dueDaysAhead) || 3;
      const dueDate = new Date(Date.now() + days * 86400000).toISOString();
      if (!requestIdRef.current) {
        requestIdRef.current = `fup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      await api("/follow-ups", token, {
        method: "POST",
        body: JSON.stringify({
          patient_id: worker.id,
          assigned_user_id: assignedUserId,
          scheduled_day: scheduledDay,
          due_at: dueDate,
          notes,
          client_request_id: requestIdRef.current,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Schedule Field Follow-up" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="followup-form" loading={loading}>Assign Follow-up</Button>
      </>}>
      <form id="followup-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>COMMUNITY CARE DISPATCH · Patient: {worker.patient_code} ({worker.display_name || "De-identified"})</p>

        <FormGrid>
          <Field label="Protocol Day">
            <Select value={scheduledDay} onChange={(e) => setScheduledDay(e.target.value)}>
              <option value="Day 3">Day 3 (Clinical response &amp; fever check)</option>
              <option value="Day 7">Day 7 (Microscopy slide &amp; compliance)</option>
              <option value="Day 14">Day 14 (Longitudinal cure / primaquine monitor)</option>
              <option value="Day 28">Day 28 (Parasitological cure confirmation)</option>
            </Select>
          </Field>

          <Field label="Assign to Health Worker" required>
            <Select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} required>
              {healthWorkers.length ? (
                healthWorkers.map((hw) => (
                  <option key={hw.id} value={hw.id}>
                    {hw.display_name} {hw.jurisdiction ? `(${hw.jurisdiction})` : ""}
                  </option>
                ))
              ) : (
                <option value="">No active health workers available</option>
              )}
            </Select>
          </Field>

          <Field label="Due in (Days from now)" required>
            <Input type="number" min={1} max={60} value={dueDaysAhead}
              onChange={(e) => setDueDaysAhead(e.target.value)} required />
          </Field>
        </FormGrid>

        <Field label="Instructions &amp; Notes for Health Worker">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* ------------------------------------- Pathologist: Diagnostic Sample */
export function PathologistSampleModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [method, setMethod] = useState("microscopy");
  const [resultStatus, setResultStatus] = useState("positive");
  const [species, setSpecies] = useState("pv");
  const [smearType, setSmearType] = useState("both");
  const [specimenType, setSpecimenType] = useState("whole_blood");
  const [notes, setNotes] = useState("Giemsa stained thick and thin blood films evaluated under 100x oil immersion");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Entity idempotency key for POST /samples (defect D1). Minted at the first
  // submit of this logical lab result. A failed submit keeps the key so a
  // retry resolves to the same result row; a confirmed create closes the
  // modal and unmounts the ref, so the next result mints a fresh key.
  const requestIdRef = useRef<string | undefined>(undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!requestIdRef.current) {
        requestIdRef.current = `smp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      await api("/samples", token, {
        method: "POST",
        body: JSON.stringify({
          patient_id: worker.id,
          method,
          result_status: resultStatus,
          species: resultStatus === "positive" ? species : undefined,
          smear_type: method === "microscopy" ? smearType : undefined,
          specimen_type: specimenType,
          notes,
          client_request_id: requestIdRef.current,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record diagnostic sample");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Record Diagnostic Sample" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="sample-form" loading={loading}>Save Sample Record</Button>
      </>}>
      <form id="sample-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>PATHOLOGY LABORATORY · Patient: {worker.patient_code} ({worker.display_name || "De-identified"})</p>

        <FormGrid>
          <Field label="Diagnostic Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="microscopy">Microscopy (Gold Standard)</option>
              <option value="rdt">Rapid Diagnostic Test (RDT)</option>
              <option value="molecular_pcr">Molecular / PCR Assay</option>
            </Select>
          </Field>

          <Field label="Result Status">
            <Select value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="indeterminate">Indeterminate</option>
              <option value="pending">Pending</option>
            </Select>
          </Field>

          {resultStatus === "positive" ? (
            <Field label="Plasmodium Species">
              <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="pv">Plasmodium vivax (Pv)</option>
                <option value="pf">Plasmodium falciparum (Pf)</option>
                <option value="mixed">Mixed (Pv + Pf)</option>
                <option value="pm">Plasmodium malariae</option>
                <option value="po">Plasmodium ovale</option>
                <option value="pk">Plasmodium knowlesi</option>
              </Select>
            </Field>
          ) : null}

          {method === "microscopy" ? (
            <Field label="Smear Preparation">
              <Select value={smearType} onChange={(e) => setSmearType(e.target.value)}>
                <option value="both">Both Thick and Thin Smear</option>
                <option value="thick">Thick Smear Only</option>
                <option value="thin">Thin Smear Only</option>
              </Select>
            </Field>
          ) : null}

          <Field label="Specimen Type">
            <Select value={specimenType} onChange={(e) => setSpecimenType(e.target.value)}>
              <option value="whole_blood">Whole Blood (EDTA / Venous)</option>
              <option value="fingerstick_blood">Capillary / Fingerstick Blood</option>
              <option value="filter_paper">DBS / Filter Paper Card</option>
            </Select>
          </Field>
        </FormGrid>

        <Field label="Microscopist / Lab Notes">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* --------------------------------- Pathologist: Slide Follow-up Modal */
export function SlideFollowupModal({
  sampleId,
  sampleCode,
  token,
  onClose,
  onSuccess,
}: {
  sampleId: string
  sampleCode: string
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [day, setDay] = useState("Day 7");
  const [received, setReceived] = useState("yes");
  const [positive, setPositive] = useState("no");
  const [reason, setReason] = useState("patient_unavailable");
  const [otherReason, setOtherReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api(`/samples/${sampleId}/slide-followup`, token, {
        method: "PUT",
        body: JSON.stringify({
          scheduled_day: day,
          received,
          positive: received === "yes" ? positive : undefined,
          positive_day: received === "yes" && positive === "yes" ? day : undefined,
          not_received_reason: received === "no" ? reason : undefined,
          other_reason: received === "no" && reason === "other" ? otherReason : undefined,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save slide follow-up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Record Slide Follow-Up" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="slide-form" loading={loading}>Record Slide Follow-up</Button>
      </>}>
      <form id="slide-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>LONGITUDINAL SURVEILLANCE · Sample Code: {sampleCode}</p>

        <FormGrid>
          <Field label="Protocol Scheduled Day">
            <Select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="Day 7">Day 7 (Primary Slide Clearance Check)</option>
              <option value="Day 14">Day 14 (Late Parasitological Check)</option>
              <option value="Day 28">Day 28 (Final Protocol Clearance)</option>
            </Select>
          </Field>

          <Field label="Was Follow-up Slide Received?">
            <Select value={received} onChange={(e) => setReceived(e.target.value)}>
              <option value="yes">Yes — Slide received and evaluated</option>
              <option value="no">No — Slide not received</option>
            </Select>
          </Field>

          {received === "yes" ? (
            <Field label="Microscopy Slide Positivity">
              <Select value={positive} onChange={(e) => setPositive(e.target.value)}>
                <option value="no">Negative (Parasites cleared)</option>
                <option value="yes">Positive (Recrudescence / Parasites persistent)</option>
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Reason Not Received">
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="patient_unavailable">Patient unavailable at site</option>
                  <option value="refused">Patient refused blood draw</option>
                  <option value="migrated">Migrated out of jurisdiction</option>
                  <option value="sample_damaged">Sample damaged in transit</option>
                  <option value="other">Other reason</option>
                </Select>
              </Field>

              {reason === "other" ? (
                <Field label="Specify Reason (Required)" required>
                  <Input type="text" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} required />
                </Field>
              ) : null}
            </>
          )}
        </FormGrid>
      </form>
    </Modal>
  );
}

/* ------------------------------------- Contractor: Enroll at a Site */
export function ContractorEnrollModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [siteId, setSiteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await api<{ items: SiteItem[] }>("/sites", token);
        if (res?.items?.length) {
          setSites(res.items);
          setSiteId(res.items[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load sites under your contract");
      }
    }
    void fetchSites();
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) {
      setError("Please select an active site");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api(`/workers/${worker.id}/membership`, token, {
        method: "POST",
        body: JSON.stringify({ site_id: siteId }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll worker at site");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Enroll Worker at Construction Site" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="enroll-form" loading={loading}>Enroll Worker</Button>
      </>}>
      <form id="enroll-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>CONTRACTOR MANAGEMENT · Worker: {worker.patient_code} ({worker.display_name || "Worker"})</p>

        <Field label="Select Site" required>
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.length ? (
              sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.area}
                </option>
              ))
            ) : (
              <option value="">No sites available under your contract</option>
            )}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Contractor: Report Health Status */
export function ContractorStatusModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [malariaStatus, setMalariaStatus] = useState("pv");
  const [treatmentStatus, setTreatmentStatus] = useState("treated");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api(`/workers/${worker.id}/reported-status`, token, {
        method: "PUT",
        body: JSON.stringify({
          malaria_status: malariaStatus,
          treatment_status: treatmentStatus,
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reported status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Update Worker Health Status" onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="status-form" loading={loading}>Update Status</Button>
      </>}>
      <form id="status-form" onSubmit={submit} style={{ display: "grid", gap: "var(--sp-3)", minWidth: 0 }}>
        {error ? <p className="m3-error" role="alert">{error}</p> : null}
        <p className="m3-hint" style={{ margin: 0 }}>CONTRACTOR HEALTH REPORT · Worker: {worker.patient_code} ({worker.display_name || "Worker"})</p>

        <FormGrid>
          <Field label="Reported Health / Malaria Status">
            <Select value={malariaStatus} onChange={(e) => setMalariaStatus(e.target.value)}>
              <option value="healthy">Healthy / No Fever</option>
              <option value="fever_unconfirmed">Fever (Unconfirmed)</option>
              <option value="pv">Plasmodium vivax (Confirmed)</option>
              <option value="pf">Plasmodium falciparum (Confirmed)</option>
              <option value="mixed">Mixed Infection</option>
            </Select>
          </Field>

          <Field label="Treatment Adherence Status">
            <Select value={treatmentStatus} onChange={(e) => setTreatmentStatus(e.target.value)}>
              <option value="treated">Treated / Medication Completed</option>
              <option value="under_treatment">Currently Under Treatment</option>
              <option value="untreated">Untreated / Awaiting Care</option>
            </Select>
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}
