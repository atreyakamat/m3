/** Sign-in / registration — rebuilt on the M3 design system.
 *  Contract preserved: POST /auth/login and /auth/signup with identical
 *  payloads; session adoption via the session provider.
 *  Seeded-account quick-fill: accounts exist in the current shared dev DB
 *  (seeded by an older seed run, PIN 1234). Repo seed.py now defines PIN 2468
 *  for fresh seeds — the divergence is documented in docs/UI_REBUILD_REPORT.md. */
import { useMemo, useState, type FormEvent } from "react";
import { api, baseUrl } from "../api";
import { Button, Card, Field, Input, Select } from "../ui/components";
import { useSession, type Session } from "../lib/session";

const SEEDED: Array<{ phone: string; role: string; label: string }> = [
  { phone: "+919000000001", role: "contractor", label: "Contractor" },
  { phone: "+919000000003", role: "clinician", label: "Clinician" },
  { phone: "+919000000004", role: "pathologist", label: "Pathologist" },
  { phone: "+919000000005", role: "worker", label: "Worker" },
  { phone: "+919000000006", role: "health_worker", label: "Health Worker" },
  { phone: "+919000000007", role: "research_lab", label: "Research Lab" },
  { phone: "+919000000008", role: "admin", label: "Admin" },
];

export function LoginScreen({ language, onToggleLanguage }: { language: "en" | "hi"; onToggleLanguage: () => void }) {
  const { adopt, expiredAt } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("worker");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hi = language === "hi";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<Session>(mode === "signup" ? "/auth/signup" : "/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify(mode === "signup"
          ? { phone, pin, display_name: displayName, role, preferred_language: "en" }
          : { phone, pin }),
      });
      adopt(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "signup" ? (hi ? "खाता नहीं बन पाया" : "Unable to create account") : (hi ? "साइन इन नहीं हो पाया" : "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  }

  function prefill(p: string, r: string) {
    setMode("login");
    setPhone(p);
    // The shared dev DB was seeded with PIN 1234 (see file header note).
    setPin("1234");
    void r;
  }

  const title = useMemo(() => (hi ? "पूर्ण निगरानी और सुरक्षा कार्यक्रम" : "M3 Surveillance"), [hi]);

  return (
    <main style={{
      minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0,1fr)", placeItems: "center",
      background: "linear-gradient(160deg, var(--n-900), var(--n-800) 55%, var(--brand-900))",
      padding: 16,
    }}>
      <div className="m3-card" style={{ width: "min(460px, 100%)", padding: "var(--sp-8) var(--sp-6) var(--sp-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--sp-5)" }}>
          <span className="m3-brand-mark" aria-hidden="true">M3</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "var(--fs-2xl)", fontWeight: 800 }}>{title}</h1>
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
              {hi ? "स्क्रीनिंग, क्लीनिकल देखभाल और पैथॉलॉजी के लिए सुरक्षित कंसोल" : "Screening, clinical care, laboratory diagnostics and site monitoring"}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onToggleLanguage}>{hi ? "EN" : "हिं"}</Button>
        </div>

        {expiredAt != null ? (
          <div className="m3-banner tone-warn" style={{ marginBottom: "var(--sp-4)" }} role="alert">
            {hi ? "सत्र समाप्त हो गया — कृपया दोबारा साइन इन करें।" : "Your session has ended — please sign in again."}
          </div>
        ) : null}

        <div className="m3-tabs" style={{ marginBottom: "var(--sp-5)" }} role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className="m3-tab" onClick={() => setMode("login")}>
            {hi ? "साइन इन" : "Sign In"}
          </button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className="m3-tab" onClick={() => setMode("signup")}>
            {hi ? "पंजीकरण" : "Register / Sign Up"}
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: "var(--sp-4)" }}>
          {mode === "signup" && (
            <Field label={hi ? "पूरा नाम" : "Full Name"} required>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Ramesh Kumar" required maxLength={120} />
            </Field>
          )}
          <Field label={hi ? "फ़ोन नंबर" : "Phone Number"} required hint={hi ? undefined : "Format: +91XXXXXXXXXX"}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919000000001" required inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label={hi ? (mode === "signup" ? "4-अंकों का पिन चुनें" : "4-अंकों का पिन") : (mode === "signup" ? "Choose 4-Digit PIN" : "4-Digit PIN")} required hint={mode === "signup" && !hi ? "4–12 digits" : undefined}>
            <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={mode === "signup" ? "••••" : "4-digit PIN"} pattern="[0-9]{4,12}" required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </Field>
          {mode === "signup" && (
            <Field label="Account Role" required hint="Administrator accounts are not self-registered">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="worker">Labour Worker (Direct Intake)</option>
                <option value="clinician">Clinician / Medical Officer</option>
                <option value="pathologist">Pathologist / Lab</option>
                <option value="health_worker">Field Health Worker</option>
                <option value="contractor">Contractor</option>
                <option value="research_lab">Research Laboratory</option>
              </Select>
            </Field>
          )}
          {error ? <p className="m3-error" role="alert" style={{ margin: 0 }}>⚠ {error}</p> : null}
          <Button type="submit" block loading={loading}>
            {mode === "signup" ? (hi ? "खाता बनाएं और साइन इन करें" : "Create Account & Sign In") : (hi ? "साइन इन" : "Sign In")}
          </Button>
        </form>

        <div style={{ marginTop: "var(--sp-6)", borderTop: "1px dashed var(--border)", paddingTop: "var(--sp-4)" }}>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", marginBottom: 8 }}>
            {hi ? "डेवलपमेंट फ़िक्स्चर खाते (सिंथेटिक डेटा) — पिन 1234 (देव DB; seed.py: 2468)" : "Development fixtures (synthetic data) — PIN 1234 in this dev DB (seed.py: 2468)"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SEEDED.map((s) => (
              <Button key={s.phone} variant="secondary" size="sm" type="button" onClick={() => prefill(s.phone, s.role)}
                title={s.phone}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <p className="m3-hint" style={{ marginTop: "var(--sp-5)", overflowWrap: "anywhere" }}>
          API: <code style={{ fontSize: "var(--fs-xs)" }}>{baseUrl}</code>
        </p>
      </div>
    </main>
  );
}
