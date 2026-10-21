// Rendered pagination verification for the M3 intake questionnaire.
// Runs the exported Expo web bundle in headless Chromium via Playwright.
// Asserts: visible step indicator, Next/Previous transitions, per-step content,
// validation gate, and answer preservation across navigation.
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8081';
let failures = 0;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROME || '/usr/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);

  async function waitStep(n) {
    const label = `Step ${n} of 6`;
    await page.getByText(label, { exact: false }).first().waitFor({ timeout: 10000 });
  }

  async function clickNext(label) {
    await page.getByText(label, { exact: true }).first().click();
    await page.waitForTimeout(250);
  }

  // Demo login
  const demoBtn = page.getByText('Use synthetic demo data without signing in', { exact: false });
  check('demo entry visible', await demoBtn.count() > 0);
  await demoBtn.first().click();
  await page.waitForTimeout(1500);

  // Dashboard -> intake card (title from i18n 'intake')
  const intakeCard = page.getByRole('button', { name: 'Open →' });
  if (await intakeCard.count() === 0) {
    check('intake card found on dashboard', false);
  } else {
    check('intake card found on dashboard', true);
    await intakeCard.first().click();
    await waitStep(1);
  }

  // Step 1 visible
  const step1 = await page.getByText('Step 1 of 6', { exact: false }).count();
  check('"Step 1 of 6" indicator visibly rendered', step1 > 0);
  const sec1 = await page.getByText('Section 1: Demographics', { exact: false }).count();
  check('only Section 1 card rendered', sec1 > 0);
  const sec2Early = await page.getByText('Section 2: Malaria History', { exact: false }).count();
  check('Section 2 NOT rendered on step 1 (true pagination, not one long form)', sec2Early === 0);

  // Validation gate: Next with empty required fields stays on step 1 and shows error
  const nextBtn = page.getByText('Malaria History →', { exact: true }).first();
  await nextBtn.click();
  await page.waitForTimeout(600);
  await waitStep(1); // still gated
  const still1 = await page.getByText('Step 1 of 6', { exact: false }).count();
  const errShown = await page.getByText('A valid mobile number is required', { exact: false }).count();
  check('Next with invalid fields stays on step 1 (validation gate)', still1 > 0);
  check('validation error message rendered', errShown > 0);

  // Fill required fields (answers must persist later)
  await page.getByPlaceholder('e.g. Ramesh Kumar', { exact: false }).first().fill('Playwright Worker');
  const dob = page.getByText('Date of Birth', { exact: false }).first();
  await page.getByPlaceholder('YYYY-MM-DD').first().fill('1992-04-10');
  await page.getByPlaceholder('+91...', { exact: false }).first().fill('+919999900001');
  await page.getByPlaceholder('e.g. Room 12, Campal Labour Colony, Panaji', { exact: false }).first().fill('Campal Labour Colony, Panaji');

  // Advance to step 2
  await nextBtn.click();
  await waitStep(2);
  const step2 = await page.getByText('Step 2 of 6', { exact: false }).count();
  check('Next advances to "Step 2 of 6"', step2 > 0);
  const sec2 = await page.getByText('Section 2: Malaria History', { exact: false }).count();
  check('Section 2 now rendered after advancing', sec2 > 0);

  // Answers preserved after navigating to step 2 (name was step-1 state)
  // Navigate back and verify.
  const prev = page.getByText('← Demographics', { exact: true }).first();
  await prev.click();
  await waitStep(1);
  const back1 = await page.getByText('Step 1 of 6', { exact: false }).count();
  check('Previous returns to "Step 1 of 6"', back1 > 0);
  const nameVal = await page.getByPlaceholder('e.g. Ramesh Kumar', { exact: false }).first().inputValue();
  check('answer survives Previous navigation (name kept)', nameVal === 'Playwright Worker');

  // Forward again
  await page.getByText('Malaria History →', { exact: true }).first().click();
  await waitStep(2);
  const step2again = await page.getByText('Step 2 of 6', { exact: false }).count();
  check('forward navigation after back works (Step 2 of 6 again)', step2again > 0);

  // Walk steps 2 -> 3 -> 4 -> 5 through the (valid) conditionals as well:
  // sections 2-4 default values are valid, so Next should advance directly.
  for (const [i, label] of ['Clinical Signs →', 'Mobility →', 'Travel Plans →'].entries()) {
    await clickNext(label);
    await waitStep(3 + i);
  }
  const at5 = await page.getByText('Step 5 of 6', { exact: false }).count();
  check('reaches "Step 5 of 6" via sequential Next', at5 > 0);
  const condBlock = await page.getByText('Section 5: Planned Travel', { exact: false }).count();
  check('Section 5 card rendered on step 5', condBlock > 0);
  // Step-change autosave: draft persisted with the preserved answers.
  const draftRaw = await page.evaluate(() => window.localStorage.getItem('m3:draft:synthetic-demo'));
  check('draft autosaved on step change and contains earlier answers',
    Boolean(draftRaw) && draftRaw.includes('Playwright Worker'));
  const submitBtn = await page.getByText('Submit Screening', { exact: true }).count();
  check('no Submit Screening button on intermediate step 5 (footer)', submitBtn === 0);
  // Final step via Travel Plans -> Review & Submit
  await page.getByText('Review & Submit →', { exact: true }).first().click();
  await waitStep(6);
  const at6 = await page.getByText('Step 6 of 6', { exact: false }).count();
  check('reaches "Step 6 of 6" (Review & Submit)', at6 > 0);
  const submitFinal = await page.getByText('Submit Screening', { exact: true }).count();
  check('Submit Screening visible ONLY on final step', submitFinal === 1);

  console.log(failures === 0 ? 'ALL PAGINATION RENDER TESTS PASSED' : `${failures} PAGINATION TEST FAILURES`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
