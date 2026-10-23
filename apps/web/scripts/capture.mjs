/**
 * M3 web console — per-role Playwright captures (real API, seeded accounts).
 * Saves PNGs to screenshots/web-rebuild/ + writes screenshot-index.md.
 * Environment: WEB (desktop Chromium headless). No physical-Android claims.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.WEB_BASE ?? "http://localhost:4173";
const OUT = process.env.OUT_DIR ?? "/home/atreya/Work/m3/screenshots/web-rebuild";
const DEV_PIN = process.env.DEV_PIN ?? "1234"; // seeded dev-login PIN per target DB
const VIEWPORT = { width: 1440, height: 900 };
/* NOTE: CORS on the healthy shared API allows localhost:5173 (the dockerized web).
 * Captures run from an alternate local port, so this harness-only browser disables
 * web security. NO_INSECURE=1 keeps real CORS enforcement (proper CORS origins
 * e.g. the isolated release-validation stack); no backend or shared-stack change
 * is made (shared stack must not be restarted). */
const LAUNCH_ARGS = process.env.NO_INSECURE ? [] : ["--disable-web-security"];

// Role → phone mapping. Default: live shared-DB mapping (older seed run), as
// documented. Set ROLES_JSON to a JSON array mapping roles to phones, e.g. for
// the release-validation disposable DB (repo seed.py mapping, PIN 2468).
const ROLES = process.env.ROLES_JSON
  ? JSON.parse(process.env.ROLES_JSON)
  : [
  { phone: "+919000000005", id: "worker", label: "Worker" },
  { phone: "+919000000003", id: "clinician", label: "Clinician" },
  { phone: "+919000000004", id: "pathologist", label: "Pathologist" },
  { phone: "+919000000006", id: "health_worker", label: "Health Worker" },
  { phone: "+919000000007", id: "research_lab", label: "Research Lab" },
  { phone: "+919000000001", id: "contractor", label: "Contractor" },
  { phone: "+919000000008", id: "admin", label: "Admin" },
];

// Sidebar titles per tab (must match AppShell NAV_TITLES English).
const TABS = [
  ["overview", "Overview"], ["analytics", "Surveillance Analytics"], ["cases", "Case Queue"],
  ["workers", "Workers"], ["samples", "Diagnostics & Pathology"], ["followups", "Follow-ups"],
  ["sites", "Construction Sites"], ["research", "Research Results"],
  ["reports", "Surveillance Reports"], ["audit", "Audit Trail"],
];

mkdirSync(OUT, { recursive: true });
const index = [];
const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function shot(page, name, note) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  index.push({ file: `${name}.png`, note, viewport: "1440x900", env: "web (Chromium 156 headless)" });
  console.log("saved", name);
}

async function signIn(page, phone) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  // Login may show a previous session — sign out via clearing storage first.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="tel"], input[inputmode="tel"]').first().fill(phone);
  await page.locator('input[type="password"]').first().fill(DEV_PIN);
  await page.locator('form button[type="submit"]').first().click();
  try {
    await page.waitForSelector(".m3-nav", { timeout: 15000 });
  } catch {
    // Surface the actual UI state for diagnosis instead of a bare timeout.
    const err = await page.locator('[role="alert"]').first().textContent().catch(() => null);
    const body = (await page.textContent("body")).slice(0, 300);
    throw new Error(`Login did not reach console for ${phone}. Alert: ${err ?? "none"} · Body: ${body}`);
  }
  await page.waitForTimeout(700);
}

/* ---------- shared login screen capture (once, worker prefill) ---------- */
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "00-login-screen", "Sign-in with seeded development fixtures listed (PIN 2468)");
  await page.close();
}

for (const role of ROLES) {
  if (process.env.ROLE_ONLY && process.env.ROLE_ONLY !== role.id) continue;
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("requestfailed", (r) => consoleErrors.push(`requestfailed: ${r.url().slice(0, 100)}`));
  try {
    await signIn(page, role.phone);

    // Which tabs this role actually sees (nav = source of truth, incl. server authz).
    const navTitles = await page.$$eval(".m3-nav-link", (els) => els.map((e) => e.textContent.trim()));

    for (const [tabId, title] of TABS) {
      if (!navTitles.includes(title)) continue;
      const btn = page.locator(".m3-nav-link", { hasText: title }).first();
      await btn.click();
      await page.waitForTimeout(tabId === "analytics" ? 2500 : 1100);
      await shot(page, `${role.id}-${tabId}`, `${role.label} — ${title}`);
      // Admin audit filters + paging visible.
      if (tabId === "audit") {
        await page.locator('input[placeholder*="ction" i], input').first().fill("sign");
        await page.waitForTimeout(900);
        await shot(page, `${role.id}-audit-filtered`, `${role.label} — Audit Trail filtered`);
      }
    }

    // Worker record drawer (roles with Workers tab).
    if (navTitles.includes("Workers")) {
      await page.locator(".m3-nav-link", { hasText: "Workers" }).first().click();
      await page.waitForTimeout(1100);
      const row = page.locator(".m3-table tbody tr").first();
      if (await row.count()) {
        await row.click();
        await page.waitForTimeout(1400);
        await shot(page, `${role.id}-worker-record-drawer`, `${role.label} — Worker record drawer (6 tabs, role-gated actions)`);
      }
    }

    // Console/page/network health BEFORE the deliberate offline toggle.
    const onlineErrors = consoleErrors.filter((e) => !/^requestfailed/.test(e));
    const netFailures = consoleErrors.filter((e) => /^requestfailed/.test(e));
    if (onlineErrors.length || netFailures.length) {
      console.log(`CONSOLE ${role.id}: errors=${onlineErrors.length} netFailures=${netFailures.length}`);
      onlineErrors.slice(0, 5).forEach((e) => console.log(`  ERR ${role.id}:`, e));
      netFailures.slice(0, 5).forEach((e) => console.log(`  NET ${role.id}:`, e));
      index.push({ file: null, role: role.id, error: `console: ${onlineErrors.length} errors, ${netFailures.length} net failures` });
    } else {
      console.log(`CONSOLE ${role.id}: clean (0 errors, 0 failed requests)`);
    }

    // Honest connectivity: offline badge state.
    await ctx.setOffline(true);
    await page.waitForTimeout(400);
    await shot(page, `${role.id}-offline-banner`, `${role.label} — offline state (real navigation-offline detection)`);
    await ctx.setOffline(true);
    await page.waitForTimeout(200);
    await ctx.setOffline(false);
    await page.waitForTimeout(400);
  } catch (err) {
    console.error(`ROLE ${role.id} FAILED:`, err.message.split("\n")[0]);
    index.push({ file: null, role: role.id, error: err.message.split("\n")[0] });
  }
  await ctx.close();
}

await browser.close();

// Write a markdown index. On ROLE_ONLY reruns, merge into the existing index.
import { existsSync, readFileSync } from "node:fs";
if (process.env.ROLE_ONLY && existsSync(`${OUT}/screenshot-index.md`)) {
  const prior = readFileSync(`${OUT}/screenshot-index.md`, "utf8");
  const extra = index.filter((e) => e.file && !prior.includes(`\`${e.file}\``));
  const rows = extra.map((e) => `| | \`${e.file}\` | ${e.note} | ${e.env} |`).join("\n");
  writeFileSync(`${OUT}/screenshot-index.md`, prior + rows + "\n");
  console.log("Index merged:", `${OUT}/screenshot-index.md`);
} else {
  const lines = [
  "# M3 web console — screenshot index (UI rebuild)",
  "",
  `Captured: ${new Date().toISOString()} · Viewport: 1440×900 · Environment: **web** (Playwright Chromium headless 156) against the real local API (seeded synthetic data).`,
  "No physical Android device was used for these captures; native-device verification is reported separately.",
  "",
  "| # | Capture | Role / screen | Notes |",
  "|---|---------|---------------|-------|",
];
index.forEach((e, i) => {
  if (!e.file) { lines.push(`| ${i + 1} | (failed) | ${e.role} | ${e.error} |`); return; }
  lines.push(`| ${i + 1} | \`${e.file}\` | ${e.note} | ${e.env} |`);
});
writeFileSync(`${OUT}/screenshot-index.md`, lines.join("\n") + "\n");
console.log("\nIndex written:", `${OUT}/screenshot-index.md`, `(${index.length} entries)`);
}
