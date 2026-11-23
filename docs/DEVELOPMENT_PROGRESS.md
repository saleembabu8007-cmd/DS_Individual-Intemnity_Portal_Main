# DoctorShield Individual Indemnity Portal: Development Progress

| | |
|---|---|
| Product | Chubb Elite Medical Malpractice Insurance (Individual Indemnity) |
| Application | `doctorshield/` (static ES-module frontend, published from `doctorshield/dist`) |
| Current phase | **Phase 5 complete: final phase of the plan.** All screens and flows are built and tested; backend integrations are **not connected or verified**. Release recommendation: **no-go for production**, go for staging and acceptance testing (section 12). |
| Last updated | 23 Nov 2026 |
| Baseline checkpoint | git commit `4486306`: "Checkpoint: baseline before Phase 1 redesign" |

---

## 1. Phase 1 results

| Area | Status |
|---|---|
| Full project audit | Done (section 2) |
| Team review: 14 issues mapped to files and phases | Done (section 3) |
| Design system (tokens, atoms, compositions) | Done |
| Header redesign (review issue #12) | Done |
| Sidebar and step navigation | Done |
| Footer redesign (review issue #9) | Done |
| Responsive global layout | Done. Verified at 320–1440px |
| Navigation and routing (review issue #13) | Partly done. In-portal step history added; remaining items in section 5 |
| Tests and build | 66/66 unit tests pass and `npm run check` passes. 15/15 browser behaviour checks pass |

### Verification performed

- `npm test`: **66 passed, 0 failed**. That is the 57 original tests plus 9 new tests in `tests/shell.test.mjs`.
- `npm run check`: all client modules parse, including the new `shell.js`.
- Browser checks in headless Edge over the DevTools protocol, against the local server:
  - Steps 2–5 are locked before Coverage is complete. Continue on an empty form shows the error summary and stays on step 1, with no page reload.
  - Browser **Back/Forward** move between application steps (Summary → Personal Particulars → Summary). The page does not reload or leave the portal, and the data entered is preserved.
  - Mobile menu opens from the button and closes with Escape. The active state shows on the correct item (Get a Quote, Renew or Claims), and sample mode carries through to the Renew and Claims links.
  - Application data survives Application → Renew → back to Application in the same tab.
- Horizontal overflow check: all 5 application steps plus the Renew and Claims pages at 10 widths (320, 360, 390, 414, 600, 768, 860, 1024, 1280, 1440). **No page overflow anywhere.** The internal component library (`design-system.html`) at ≤600px has section links in its own scroll strip, which is expected.
- Visual review by screenshot of every step at desktop and mobile, the error state, dialogs, the mobile menu and the services pages.

---

## 2. Audit findings

### 2.1 Architecture

- **Stack:** plain JavaScript ES modules, no framework, no dependencies (`package.json` has no `dependencies`). No build step. `dist/` is both source and deployable output.
- **Local server:** `server.mjs` is a static file server on 127.0.0.1:4173 with path-traversal protection and `Cache-Control: no-store`. It is for local preview only and is not used on Vercel.
- **Deployment:** `doctorshield/vercel.json` publishes `dist` with framework detection, install and build turned off.
  - ⚠ The README says there is also a repository-root `vercel.json`. **No such file exists.** The Vercel project must therefore use `doctorshield` as its Root Directory.
- **Entry points:** `index.html` is the 5-step application. `services.html?flow=renewal|claims` is Renew and Claims. `design-system.html` is the internal component library.
- **State:** a single in-memory `data` object in `app.js`. It is saved as a draft in `sessionStorage` (`draft.js`) for 6 hours, scoped to the browser tab, with input sanitising on read.
- **Business rules:** kept separate and unit-tested:
  - `catalog.js`: 22 classifications and their limits. This is a public-source snapshot, **not** authoritative underwriting data.
  - `clinic-rules.js`: clinic/PIC add-on routing.
  - `validation.js`
  - `allocation-model.js`: specialist allocation.
  - `service-model.js`: OTP session, claim validation, safe hand-off links.
- **Integration boundary:** every `api.js` operation throws `IntegrationRequiredError`. No premium is calculated and nothing is submitted, emailed, sent by OTP or paid. `?sample=1` / `?review=1` switch on an explicit simulation (`sample-quote.js`, `preview-api.js`). The README states the sample rates are not insurer pricing.

### 2.2 Problems found

| # | Finding | Severity | Phase 1 action |
|---|---|---|---|
| A1 | **CSS was stacked overrides.** `product-compositions.css` redefined the same selectors up to 5 times on top of `application.css`, including 4 different `:root` blocks that changed the page background, layout widths and action-bar clearance. Every visual change risked a regression. | High | Rebuilt as 4 layered files: tokens → atoms → compositions → shell. Each selector is now defined once. |
| A2 | Header looked prototype-like: a "Saved in this tab" status in the middle of the header, a hidden "Home" link, Contact Us hidden below 700px, no mobile menu, and the logo lacked the official "MALAYSIA" lockup. | High (#12) | Header fully redesigned. |
| A3 | Footer had "Start again" (destructive, one click away), plus a mobile-only "Watch video / Policy documents / User guide" row. | High (#9) | Footer now has Terms and Conditions and Privacy Policy only. |
| A4 | Browser Back left the portal completely, because the steps were not in browser history. This is the most likely cause of the "page redirects" report. | High (#13) | Step history added (pushState/popstate). Locked steps cannot be reached through Forward. |
| A5 | Mobile progress was a row of unlabelled numbered circles, with the step name shown separately. | Medium | Replaced with "Step N of 5 · Next: …" and a 5-segment progress track. |
| A6 | Primary buttons had dark-teal text on teal. Text-link teal and the selection teal were defined in several places. | Medium | Tokenised: navy-on-teal primary buttons (4.8:1 contrast); teal-700 for links and selection (AA on white). |
| A7 | Sidebar had a hidden duplicate "Policy documents / User guide" block (`.rail-resources`, set to `display:none` but still in the DOM and tab order). | Low | Removed. The guide card is redesigned with a clear action link. |
| A8 | Short pages (Renew, Claims) left a band of empty canvas under the footer. On mobile, Renew and Claims initially scrolled the header out of view (`main.focus()`). | Low | Fixed: sticky-footer layout and `focus({preventScroll:true})`. |
| A9 | The component library documented outdated colour values. | Low | Updated to the new tokens. |
| A10 | Unused legacy files are deployed: `refined.css`, `styles.css`, `illustration.js`, `assets/ds_logo.svg` (now replaced), plus about **3.9 MB** of unused images (`insurance-guide.png`, `physician-portrait.png/.jpg`). | Low | **Not deleted.** Owner decision needed (section 6). |
| A11 | `summary()` in `app.js` is dead code. The `start-again` / `clear-application` handlers have no trigger now that the footer link is gone. | Low | Left in place. Clean up in a later phase. |
| A12 | Mobile number validation is inconsistent. Personal Particulars accepts any 8–18 characters; Renew/Claims require a Malaysian mobile (`01x…`). | Medium (#7) | Logged for Phase 4. |
| A13 | Editing any field on an earlier step locks all later steps (`maxStage` is reset) and clears the declaration acceptance. The data is kept, but users must click forward again. This is intended for premium accuracy, but can feel like a "reset". | Medium (#13) | Logged. Needs a product decision (section 5). |

### 2.3 Feature completeness

| Feature | State |
|---|---|
| Coverage (classification, limits, specialist allocation, start/end date, email, promo, consent) | Built. Rules are a public-source snapshot. |
| Quotation (premium, clinic/PIC add-ons, Buy now / Email me) | UI built. **Premium shows "Not yet calculated"** outside sample mode. The "Email me" option ends in a "not connected" error, and there is no outcome page. |
| Personal Particulars | Built. TIN, patients and income are optional (see #3, #8). |
| Declaration | Built. Disclosure details textarea appears when the answer is adverse. "Important Notices" and "Declaration and Authorization" open the **same** dialog (#14). |
| Summary | Built as grouped review sections. **No premium breakdown table** like the current live site (#5, #10). |
| Payment | Payment-method choice is built. Payment is disabled outside sample mode. **No success, failure or pending pages** (#6). |
| OTP (application) | Review screen only. Not connected. |
| Renew | Mobile → OTP → policy list → hand-off. Not connected. |
| Claims | Initial discussion and 4-step claim form with attachments, then review and submit. Not connected. |

---

## 3. Team review: the 14 issues

Source: `individual-indemnity-new-design-changes 1.docx`. The phase assignments for Phases 2–5 are a **proposal** and need confirming against the agreed phase plan.

| # | Review comment | Root cause / affected code | Proposed phase | Status |
|---|---|---|---|---|
| 1 | "Email me quote page is not available" | `app.js` `case 'next'` → `boundary('emailQuote')` shows a "service not available" notice. No outcome page. `states.quoteSent` exists only as a review screen. | 2 | 🟡 **Built, not connected.** Email flow, progress, retry and confirmation screen are done. Sending needs `/api/sendIndicativeEmail` connected and returning explicit confirmation (section 9). |
| 2 | "Missing the 12 months premium amount" | `quotation()` has no "standard premium for a 12-month period" line. The live site shows "(ii) … standard premium for a 12 month period will be RM …". Needs a server value. | 2 | 🟡 **Built, not connected.** Shown from `premium.oneyearpremium` next to the pro-rated premium and dates. Figures appear once the quote API is connected. |
| 3 | "Don't show TIN field in summary page. TIN number popup is missing." | `reviewScreen()` adds a "Tax Tin Number" row when filled. No TIN help dialog exists. | 3 | ✅ **Done.** The confirmation popup is restored with the live wording, showing NRIC (masked, with an accessible reveal), Date Of Birth, TIN (when there is one) and Email, plus Edit/Confirm. TIN is removed from the Summary. The server TIN lookup (`/api/getTaxTinCheck`) is used when connected. |
| 4 | "Negative declaration textbox" | `declarations()` shows one shared textarea when any answer is adverse. Clarification needed: one textbox per adverse answer, or a change to the trigger/label? | 3 | ✅ **Done.** One explanation box per adverse answer, using the live mapping (individual Q1 Disagree, Q2–Q4 Yes; clinic Q1–3 shared plus Q4 separate). Each is mandatory when shown, and the text is kept if the answer changes. |
| 5 | "Premium amount was not shown in summary page" | `reviewScreen()` has no premium section. The price appears only in the fixed action bar. | 4 | ✅ **Done, not connected.** The Summary has a full premium breakdown from the quotation service, recalculated before payment. No zero or sample value is ever shown as a real premium. |
| 6 | "Payment success page is missing" | No success, failed or pending result screens (only sample-mode modals). `api.createPayment` is not connected. | 4 | 🟡 **Built.** `payment-result.html` has success, pending, failed, cancelled and not-confirmed states. Success is shown only after backend verification, which needs a status endpoint (section 10.3). |
| 7 | "Which mobile number should I enter? Not accepted in renewal and claim flow" | `service-model.js` `mobileNumber()` requires `01x` Malaysian mobiles. The "+60" hint sits *below* the field and reads like a value. The tester entered `4567876567`. | 5 | ✅ **Done in the frontend.** Live phone format, "+60" inside the field, local or international input, SMS/WhatsApp, expiry, resend, attempt limits and neutral errors. 🟡 OTP and claim services need connecting (section 11.1). |
| 8 | "Number of patients and income fields mandatory, not optional" | `personal()` passes `optional:true`. `validatePersonal()` does not require `patients` / `revenue`. | 3 | ✅ **Done.** Both are mandatory whenever the classification asks for them. Patients must be a whole number of up to 8 digits. Income must be an RM amount with up to 2 decimals, and is formatted on blur. |
| 9 | "Footer content is only terms and conditions and privacy policy" | `index.html` / `services.html` footer | **1** | ✅ **Done** |
| 10 | "I need a summary page just like the one on the current site" | `reviewScreen()` layout. The current site has plan, classification, period, auto-reinstatement, coverage table, then total/discount/nett/SST 8%/stamp duty/final premium, then payment option. `premiumBreakdown()` already provides the table component. | 4 | ✅ **Done.** Same information structure as the live summary, in the new design (section 10.1). |
| 11 | "Remove this policy document section and the popup related to this" | `quotation()` `.quote-documents` block, and `case 'documents'` dialog. `declarations()` links "Policy Wording" / "Product Disclosure Sheet" to the same dialog. | 2 | ✅ **Done.** Section and dialog removed. Policy Wording disclosure line kept (with a link when the quote supplies `policy_wording_pdf`). The declaration's Product Disclosure Sheet is now a direct PDF link. |
| 12 | "Change the whole header" | `index.html` / `services.html` header, `shell.css`, `shell.js` | **1** | ✅ **Done** |
| 13 | "Page should not be redirected anywhere" | Steps were not in browser history, so Back left the portal. Renew/Claims are separate pages. Editing earlier steps re-locks later ones. | **1** (start), 3–5 | ✅ **Done within the portal.** Intentional external hand-offs remain (section 12.1). Re-locking after edits awaits a product decision (section 5). |
| 14 | "Important notices and declaration and authorization show the same popup" | `declarations()`: both buttons use `data-action="declaration"`, which opens `disclosureHtml` (Important Notices). | 3 | ✅ **Done.** Two separate popups made by splitting the approved text unchanged: Important Notices (Duty of Disclosure → Subrogation) and Declaration and Authorization (Declaration & Signature plus the personal data consent). |

---

## 4. Design system (Phase 1 deliverable)

### Layers and load order

`fonts.css` → `application.css` (imports `tokens.css`) → `product-compositions.css` → [`services.css` on services pages] → `shell.css`

| File | Responsibility |
|---|---|
| `tokens.css` | Brand primitives, semantic roles (surface, content, border, action, focus, state), type scale, spacing, radii, elevation, motion, layout, and responsive token overrides. Older alias names are kept so earlier selectors still resolve. |
| `application.css` | Foundations and atoms: fields, select, date picker, calculated output, help/error text, radio choices, checkboxes, buttons, links, badges, section headings, disclosure, notices, error summary, dialogs, document rows, tables, status screens. |
| `product-compositions.css` | Insurance compositions: content cards, coverage summary, premium total, add-on cards, specialisation allocation, persistent premium/action bar, declarations, branches, review/summary, service cards. |
| `shell.css` | Header, mobile menu, page layout, sidebar rail, vertical stepper, mobile progress, help strip, footer, print. |
| `shell.js` | Header active state, mobile menu (toggle, Escape, outside click, resize), sample-mode link propagation. Pure helpers are unit-tested. |

### Key decisions

- **Colour:** Teal `#08A5B5` is the action colour and Navy `#132766` is the identity/heading colour. The canvas is `#F2F8FA` (very light blue-teal) and cards are white. Primary buttons use **navy text on teal** (4.8:1). Text links and selected states use `teal-700 #067A85` (AA on white).
- **Type:** Kanit for headings (matches the logotype) and Inter for body and controls. Scale: 28 title, 22 dialog, 19 section, 16 subheading, 15 body, 14 label, 13 small, 12 caption. Inputs use 16px on mobile to prevent iOS zoom.
- **Shape and elevation:** 8px controls, 12px cards, 16px dialogs. One card shadow, one raised shadow and one dialog shadow. No decorative gradients.
- **States:** hover, focus (navy outline plus teal halo), selected (teal-700 border, teal-50 surface, inner ring), disabled, read-only (dashed), invalid (danger border and tint, icon message, linked error summary), busy (spinner and `aria-busy`).
- **Header:** official DoctorShield Malaysia logo, "Individual Indemnity" with the product name, then Get a Quote, Renew, Claims (active underline) and a Contact Us button (opens in a new tab, so the application is not interrupted). "Underwritten by Chubb · Distributed by JA Assure" shows on wide screens. Below 860px a menu button opens a panel that also holds the user guide link and the underwriter mark.
- **Stepper:** compact vertical stepper with completed (teal check), current (navy with halo), upcoming (outline) and locked states, and connecting lines that turn teal as steps are completed. On mobile it becomes the progress header.
- **Mobile action bar:** price on the left and actions on the right. Back becomes an icon-only button (its accessible name is kept) so the price and the primary action are not squeezed.

---

## 5. Unresolved navigation problems (#13)

1. **Renew and Claims are separate pages.** The header links cause a full page load. The draft is kept (verified), but a single-page approach or prefetching would remove the flash. *Phase 4.*
2. **Editing an earlier step locks later steps** and clears declaration acceptance (`app.js` `input`/`change` handlers set `maxStage`). Data is kept. **Product decision needed:** should editing contact details (e.g. email or mobile) still require stepping through again, or only fields that affect the premium?
3. **Sample-mode hand-off** `services.html` → `./?sample=1&renewal=1` reloads the application with sample data. This is preview only.
4. **New tab = new draft.** The draft uses `sessionStorage`, so a link opened in a new tab starts empty. This is intended for privacy; confirm it is acceptable.
5. **External destinations that remain on purpose:** Contact Us, Terms and Conditions, Privacy Policy, PIDM/Chubb disclosure links, the user guide PDF and policy PDFs (all open in a new tab). The claims appointment hand-off goes to `outlook.office365.com` (allow-listed in `safeServiceLink`). The payment gateway will be external in Phase 5.
6. `clear-application` performs a full reload. It has no trigger now; decide whether a "Start a new application" option is needed anywhere.

---

## 6. Remaining integration blockers

| Blocker | Needed for | Owner input required |
|---|---|---|
| Quote calculation API (premium, 12-month standard premium, breakdown, discount, SST, stamp duty, promo validation) | #2, #5, #10, quotation, summary | Endpoint, auth, response contract |
| Authoritative classification and eligibility rules (replacing the public snapshot in `catalog.js`), backdating and renewal rules | Coverage | Rules source |
| Application submission API | Summary → payment | Endpoint and contract |
| Payment gateway (both "Credit/Debit Card/Wallet/Personal Internet Banking" and "Business Internet Banking"), callback and status endpoints | #6 | Provider, merchant credentials, return URLs |
| Quotation email service (indicative quotation plus policy wording) | #1 | Provider and template |
| SMS/WhatsApp OTP (application, renewal, claims) | #7, Renew, Claims | Provider and sender IDs |
| Policy lookup (by verified mobile), renewal hand-off URL, claims submission and attachment storage | Renew, Claims | Endpoints |
| Legal and content wording: TIN help popup, "Declaration and Authorization" (separate from Important Notices), policy wording delivery | #3, #14, #11 | Approved text |
| Server runtime: Vercel is set up as static-only. API calls need a same-origin proxy/serverless functions or an approved CORS origin | All integrations | Hosting decision |
| Brand asset: `underwritten-by-chubb.jpg` is 86×27 px (soft on high-DPI screens) | Header | Vector or 2× asset |
| Legacy files (`refined.css`, `styles.css`, `illustration.js`, `ds_logo.svg`, ~3.9 MB of unused images) | Payload size | Approval to delete |

---

## 7. Files changed in Phase 1

| File | Change |
|---|---|
| `doctorshield/dist/tokens.css` | Rewritten: complete token set |
| `doctorshield/dist/application.css` | Rewritten: foundations and atoms |
| `doctorshield/dist/product-compositions.css` | Rewritten: compositions only, no duplicate overrides |
| `doctorshield/dist/shell.css` | **New**: header, rail, stepper, mobile progress, footer, layout |
| `doctorshield/dist/shell.js` | **New**: header and menu behaviour |
| `doctorshield/dist/index.html` | New header and footer markup, stylesheet order |
| `doctorshield/dist/services.html` | New header and footer markup, stylesheet order |
| `doctorshield/dist/app.js` | Sidebar markup, mobile progress, help strip, action-bar wrapper, document title, step history (pushState/popstate), removed old header link rewriting. **No business-rule changes.** |
| `doctorshield/dist/services.js` | `main.focus({preventScroll:true})` |
| `doctorshield/dist/design-system.js` / `.html` | Token values documented, official logo |
| `doctorshield/dist/assets/doctorshield-logo.svg` | **New**: official DoctorShield Malaysia logo (from the live portal) |
| `doctorshield/dist/assets/underwritten-by-chubb.jpg` | **New**: underwriter mark (from the live portal) |
| `doctorshield/tests/shell.test.mjs` | **New**: 9 tests |
| `doctorshield/package.json` | `check` script includes `shell.js` |
| `doctorshield/README.md` | Architecture and verification notes updated |
| `.gitignore` | **New** (repository initialised for the checkpoint) |
| `docs/DEVELOPMENT_PROGRESS.md` | **New**: this document |

---

## 8. Phase 2: Coverage, quotation, premium and email quotation

### 8.1 Results

| Task | Status |
|---|---|
| 1. Coverage page | ✅ Done. Redesigned into "Your practice", "Coverage period" and "Contact details" cards. Date limits, automatic end date, promo check on Continue, validation, data kept on return. |
| 2. Quotation page | ✅ Done (UI): coverage summary, premium panel, add-ons, automatic reinstatement, proceed options, Back/Continue. |
| 3. 12-month premium (#2) | 🟡 **UI done, not connected.** No figures can be shown until the quote API is connected. |
| 4. Recommended add-ons | ✅ Logic verified. Selections persist and trigger re-pricing. Add-on prices come from the quote, so they are not connected. |
| 5. Email quotation (#1) | 🟡 **UI and flow done, not connected.** It never shows success unless the service confirms. |
| 6. Policy documents section (#11) | ✅ Done |
| 7. Verification | ✅ 84/84 unit tests, `npm run check`, 30/30 browser checks, 30/30 overflow checks |

**Nothing is shown as connected that has not been verified.** No request was sent to the production DoctorShield backend during this phase. Calling `/api/calculatePremium` creates a quotation record on the live system, so it must be tested against a staging environment.

### 8.2 Sources for the business rules

All rules below come from the live portal's own client code (`my-individualindemnity.doctorshield.com/assets/js/home.min.js`, reviewed 23 Nov 2026). They are not invented.

| Rule | Live source | Implemented in |
|---|---|---|
| 22 classifications, with IDs | `#classification_id` options | `catalog.js`. **All 22 IDs and names match the live portal exactly.** |
| Limits per classification | Server: `/api/getLiabilities` → `{liabilities:{id:label}}` | Live mode loads them from the API. Unconnected mode uses the catalog snapshot. |
| Earliest start date | `validateInsuranceDate`: start ≥ today. Backdating only through the admin-enabled backdate agreement. | `coverage-rules.js` `startDateBounds` |
| Latest start date | 30 June of next year if today ≥ 1 April, otherwise 30 June this year | Same. **Bug fixed:** the app previously allowed "nine months" (up to 23 Aug 2027 today). |
| End date | `setInsuranceEndDate`: start before 1 July → 31 Dec of the same year; on/after 1 July → 31 Dec of the next year | `coverage-rules.js` `policyEndDate`. **Bug fixed:** the app always used 31 Dec of the start year. The live screenshot (26/11/2026–31/12/2027) confirms the correct rule. |
| End-date note | "Policy end date is always 31'st December" | Hint under the End Date field |
| Pro-rated vs full year | Start on 1 Jan = "This premium is for the period…". Otherwise "(i) This premium is pro-rated for the period… (ii) …the standard premium for a 12 month period will be RM…" | `premiumPanel()` |
| 12-month premium | `premium.oneyearpremium` | `parseQuoteResponse().oneYear` |
| Promo code | `/api/validatePromoCode` (`promo_code`, `classification_id`), checked on Coverage Continue | `continueFromCoverage()` |
| When to re-price | Coverage submit, limit change, add-on/clinic-limit change, locum answer | Quote key (`pricingKey`) and auto-refresh |
| Add-on routing | Question handlers (verified 2 Nov 2026) | `clinic-rules.js`, unchanged |

⚠ **Conflict in the live code:** the date picker's `onafterselect` uses a 1 April cut-off (Jan–Mar start → same year). It is immediately overridden by the `change` handler's 1 July rule, so the 1 July rule is what customers get. **Please confirm 1 July is the intended rule.**

The live error text says "within nine months from today", but the actual limit is 30 June. The new message states the real date ("Please choose a start date on or before 30 Jun 2027.").

### 8.3 Integration design

`quote-service.js` exposes one interface (`getLiabilities`, `validatePromo`, `calculate`, `sendQuotationEmail`) with three implementations:

| Mode | When | Behaviour |
|---|---|---|
| **Unconnected** (production default) | `<meta name="ds-api-base" content="">` in `index.html` | Every call throws `IntegrationRequiredError`. The premium shows "Not yet calculated" with an explanation. Email shows "not available yet. No email has been sent." |
| **Live** | `ds-api-base` set to an `https` origin, or `/` for same origin | Fetches the CSRF token (`/api/getCSRFToken`), then posts form-encoded requests using the **live field names** with credentials and `X-CSRF-TOKEN`. 20-second timeout. Errors are typed and retryable. |
| **Preview** | `?sample=1` only | Illustrative values, always labelled "Sample · not insurer pricing" and "No email was sent". |

Safeguards:
- **Stale quotes are never shown.** A quote is tied to its priced inputs (classification, limit, start date, promo, allocations, clinic/PIC answers and add-ons). Any change hides the old price and re-prices.
- A response with a different start date is rejected.
- Amounts are parsed strictly. A missing final premium is an error, not RM 0.
- Policy wording links must be `https`.
- **Email success needs explicit confirmation** (`success:true` or `status: sent/queued/accepted/success`). The live client ignores this endpoint's response, so a plain 200 is not treated as sent.
- The email branch does not need payment. Failure keeps the customer on the quotation page with **Try again**, with no redirect.

### 8.4 Items to confirm with the backend team (marked `VERIFY` in code)

1. `specializations` payload: the live client posts `serializeArray()` of server-generated fields. The field names are needed.
2. Encoding of the yes/no answers (`1`/`0` assumed) and the `clinic_type_value` values.
3. Premium block selection: we use `reviewPage.medical_establishment` when the clinic package is selected, otherwise `reviewPage.individual`. We need confirmation that the breakdown mapping is correct: `without_discount_premium` → Total, `discount`, `total_premium_after_discount` → Nett, `tax_amount` → SST 8%, `stamp_duty`, `total_premium` → Final.
4. `/api/sendIndicativeEmail` must return an explicit acknowledgement (e.g. `{"success":true}`).
5. Cross-origin access: this site is static on Vercel and the API is on `my-individualindemnity.doctorshield.com`. Either serve this frontend from that origin (set `ds-api-base` to `/`), add a Vercel rewrite/proxy, or enable CORS with credentials for the portal origin.
6. A **staging** endpoint for acceptance testing, because live calls create quotation records.

### 8.5 Files changed in Phase 2

| File | Change |
|---|---|
| `dist/coverage-rules.js` | **New**: start-date limits, end date, full-year check, API date format |
| `dist/quote-service.js` | **New**: quotation service boundary (unconnected, live, preview), request/response mapping, email confirmation |
| `dist/app.js` | Coverage and Quotation pages rebuilt. Premium panel, proceed options, email flow and confirmation screen added. Automatic re-pricing, promo check, live limits. Policy documents popup removed; PDS and Policy Wording are direct links in the declaration. |
| `dist/validation.js` | Uses the verified date rules. Accepts live limits. |
| `dist/components.js` | `field()` supports `min`, `max` and `inputmode` |
| `dist/sample-quote.js` | Preview-only 12-month reference figure |
| `dist/product-compositions.css` | Premium panel, facts, loading skeleton, reinstatement note, option cards, confirmation screen |
| `dist/index.html` | `ds-api-base` configuration meta |
| `tests/coverage-rules.test.mjs`, `tests/quote-service.test.mjs` | **New**: 18 tests |
| `tests/validation.test.mjs` | Date-limit test updated from "nine months" to the verified 30 June rule |
| `package.json` | `check` includes the new modules |

### 8.6 Verification

- **Unit tests:** 84/84 pass, including the 18 new ones. They cover:
  - end and start dates on both sides of each cut-off
  - live request field names and date format
  - response mapping (premium, 12-month, discount, dates, policy wording)
  - rejection of malformed or unsafe responses
  - stale-quote keys
  - CSRF and credentials on every live call
  - silent or failed email treated as **not sent**
  - network failure and mismatched dates as errors
  - an unconnected service that never invents data
- **Browser checks:** 30/30 pass in Edge. They cover:
  - the date picker's min/max and both end-date cases
  - rejecting a start after 30 June, with the right message
  - an honest unconnected premium state
  - no Policy documents section
  - disclosures kept
  - each add-on question path and the add-on selection
  - the selection persisting through Back/Continue
  - email progress, unconnected email failure without a redirect, and the sample confirmation
  - re-pricing when an add-on changes, with the panel and action bar agreeing
  - Buy now going to Personal Particulars
- **Overflow:** no horizontal overflow on Coverage, Quotation with both add-ons, or the confirmation screen, at 10 widths from 320 to 1440px.

---

## 9. Phase 3: Personal Particulars, validation and Declaration

### 9.1 Results

| Task | Status |
|---|---|
| 1. Personal Particulars redesign | ✅ Done. Three sections (Personal details, Contact details, Practice details), "+60" and "RM" prefixes, help text on every field, specific error messages, responsive two-column/one-column layout |
| 2. Mandatory patients and income (#8) | ✅ Done |
| 3. Personal details confirmation popup (#3) | ✅ Done. TIN removed from the Summary |
| 4. Declaration redesign | ✅ Done. Numbered question cards, consistent Yes/No (Agree/Disagree for Q1) controls, a separate acknowledgement card |
| 5. Explanation boxes (#4) | ✅ Done |
| 6. Distinct legal popups (#14) | ✅ Done |
| 7. Form state and navigation | ✅ Verified: Back/Forward, reload in the same tab, answer changes |
| 8. Testing | ✅ 95/95 unit tests, `npm run check`, 40/40 browser checks, 56/56 overflow checks |

### 9.2 Sources for the business rules

All rules come from the live portal's quote form and client code (reviewed 23 Nov 2026), except where marked *Review*.

| Rule | Live source | Implemented |
|---|---|---|
| Name characters | `jsCharacterOnly`: `/^[A-Za-z.,/@ ]*$/` | `nameError` |
| Date of birth | `validateDOB`: not in the future, age **16–117** | `dobError`. **Was:** any past date. |
| Identity number | `nric_number`, required when the classification needs it (`need_reg_no`), max 12. A 12-digit value locks nationality to Malaysia; other values (passport) are accepted. | `identityError`. Malaysians must give a 12-digit NRIC; other nationalities may give NRIC or passport, and the label becomes "NRIC / Passport Number". |
| Nationality list | `#nationality` options | Unchanged. Matches live exactly. |
| Mobile | "+60" prefix, leading 0 removed, numeric, ≥ 7 digits, max 11 characters | `mobileError` (7–10 digits after the prefix). **Was:** any 8–18 characters. |
| Patients | `no_of_patients`, numeric, max 8 digits. Label "No of Patients Served in <previous year>" | `patientsError`. Label now "…in 2025". **Mandatory: Review #8.** |
| Income | `revenue`, numeric input mask, 2 decimals, grouped | `incomeError`, `formatIncome`. **Mandatory: Review #8.** |
| Confirmation popup | `jsTaxDisplayModel`: "Kindly review your personal details below and confirm to proceed"; NRIC Number, Date Of Birth, Tax Tin Number, Email Address; Edit / Confirm. Shown after Personal Particulars when an NRIC is present. | `confirmPersonal()` |
| TIN | **The live portal does not ask the applicant for a TIN.** It looks the TIN up on the server from the NRIC (`/api/getTaxTinCheck {nric_value} → {result}`). | The optional TIN field is kept, as Phase 3 requires. The popup shows the server TIN when connected, otherwise the TIN entered. The TIN is not on the Summary. |
| Explanation fields (individual) | `no_claim_desc` (Q1 **Disagree**), `aware_of_errors_desc`, `desciplinary_action_desc`, `criminal_charges_desc` (Q2–4 **Yes**). Label "Please provide details below". | `declarationDetailFields()`, keys `q0Details`…`q3Details` |
| Explanation fields (clinic) | `clinic_package_answers`, shown when **any of Q1–3 is Yes**, with the approved helper "If you had answered Yes to any of the three questions above, please provide full details and the status of each claim, lawsuits, allegations or matter". `clinic_package_criminal_charges_desc` for **Q4 Yes**. | `orgDetails`, `orgCriminalDetails`. **Was:** one box for any of Q1–4. |
| Legal popups | The live `jsImportantAndNoticesModel` holds both parts. Both links open it (the cause of #14). | Split at the "Declaration & Signature" heading. **No wording changed:** the two parts joined together are byte-identical to the previous text (3,824 characters, covered by a test). |

### 9.3 Privacy and security
- In the confirmation popup the NRIC is masked (`850615-••-••34`). An accessible "Show full number" toggle (`aria-pressed`) lets the applicant check it.
- The TIN and NRIC never appear on the Summary. The TIN is only used in Personal Particulars and the confirmation.
- The draft stays in `sessionStorage` (one browser tab, 6-hour expiry), as in earlier phases. It is never put in `localStorage` or the URL.
- Every value displayed is escaped. The explanation text is length-capped when restoring a draft.

### 9.4 Bugs found and fixed during testing
1. Explanation text was stored as a declaration answer, because any field name starting with `q` was treated as an answer. It is now routed correctly (`isAnswerName`).
2. Edit in the confirmation popup lost focus to the Continue button, because the dialog close handler restored focus afterwards. Focus now returns to the NRIC field.

### 9.5 Verification
- **Unit tests:** 95/95, including 11 new ones in `tests/personal-declaration.test.mjs`. They cover:
  - name rule
  - date-of-birth boundaries (exactly 16 and exactly 117)
  - NRIC vs passport by nationality
  - masking
  - mobile normalisation
  - patients and income formats
  - patients and income mandatory only when the classification asks
  - TIN format
  - individual and clinic explanation mapping, with independent triggers
  - the legal text split, unchanged in total
- **Browser (Edge):** 40/40 checks, covering:
  - the three sections
  - no "Optional" on patients and income
  - errors when the form is submitted empty
  - a specific message for each invalid field
  - passport accepted for a non-Malaysian applicant
  - the NRIC locking nationality
  - income formatting
  - the popup's approved sentence, field rows, masking, reveal, Edit focus, Escape and Confirm
  - explanation boxes inside the right question
  - text kept when an answer changes
  - missing explanations or acknowledgement blocking Continue
  - each popup showing only its own content
  - focus returning to the link that opened a popup
  - the inline link not ticking the checkbox
  - no TIN on the Summary
  - explanations listed on the Summary per question
  - Back/Forward and reload keeping every field
  - keyboard-focusable radios
- **Layout:** no horizontal overflow on Personal Particulars, its error state, the confirmation popup, both declaration routes, the notices popup or the Summary, at 8 widths from 320 to 1280px.

### 9.6 Files changed in Phase 3

| File | Change |
|---|---|
| `dist/personal-rules.js` | **New**: name, date of birth, identity, masking, mobile, patients, income and TIN rules |
| `dist/validation.js` | `validatePersonal` uses the verified rules. New `declarationDetailFields`; per-question explanation validation. |
| `dist/content.js` | Approved text split into `importantNoticesHtml` and `declarationAuthorizationHtml`. `disclosureHtml` is now their exact concatenation. |
| `dist/app.js` | New Personal Particulars and Declaration pages, confirmation popup, two legal popups, TIN removed from the Summary, explanations on the Summary, mobile and income formatting, answer/explanation field routing fix |
| `dist/quote-service.js` | `lookupTin` (live `/api/getTaxTinCheck`; unconnected and preview modes) |
| `dist/components.js` | `field()` supports `prefix` and `maxlength` |
| `dist/application.css`, `dist/product-compositions.css` | Input prefix, declaration cards and explanation boxes, acknowledgement card, legal-link buttons, legal and confirmation dialogs |
| `tests/personal-declaration.test.mjs` | **New**: 11 tests |
| `tests/validation.test.mjs` | Explanation key updated to the per-question field |
| `package.json` | `check` includes `personal-rules.js` |

### 9.7 Items to confirm
1. **TIN source:** the live portal gets the TIN from the server and has no TIN input. Phase 3 asked for a TIN field, so it is kept and optional. Should the field be removed once `/api/getTaxTinCheck` is connected, leaving only the server value?
2. **Popup split:** the two popups are separated at the existing "Declaration & Signature" heading. Please have the insurer confirm that this division is correct.
3. **Patients/income limits:** the live site sets no minimum or maximum (patients ≤ 8 digits; income is free-form). We accept 0 and above; the income ceiling is RM 999,999,999,999.99. Confirm whether a minimum such as more than 0 is required.
4. **Live backend fields:** `specializations` uses `specialization[<server id>]` fields (found this phase). Our allocations are keyed by list position, so the backend's specialisation IDs are needed to send them (section 8.4, item 1).

---

## 10. Phase 4: Summary, premium breakdown, payment and result pages

### 10.1 Results

| Task | Status |
|---|---|
| 1. Summary page redesign (#10) | ✅ Done. Five sections: **Coverage summary** (plan, classification, period, Automatic Reinstatement, a type-of-coverage/limit table, service details), **Applicant information** (personal, contact, practice, branches), **Declaration** (answers and explanations, collapsible), **Premium breakdown**, **Payment** (methods, Back, Proceed to Payment). |
| 2. Missing premium (#5) | ✅ Done in the frontend, 🟡 not connected. The Summary shows the premium the quotation service returned for the current classification, limit, dates, add-ons and promo, and updates as soon as it arrives. With no backend it says "Not yet calculated" and never shows RM 0.00 or a sample figure. |
| 3. TIN removed from Summary (#3) | ✅ Done (Phase 3, rechecked). The NRIC is now also masked on the Summary (850615-••-••34). |
| 4. Correct premium breakdown | ✅ Done. Each line is mapped from the fields the live summary uses (10.2). The "25% commission" and "SST 8%" labels are removed because no rate comes from the service. A breakdown that does not add up is rejected and payment is blocked. The premium is recalculated just before payment; if it changed, payment stops and the new amount is shown. |
| 5. Payment options | 🟡 Built, not connected. The two methods the live portal offers are kept: "Credit/Debit Card/Wallet/Personal Internet Banking" (`credit_card_payment`) and "Business Internet Banking" (`business_payment`). A choice is required, double submission is prevented, and each stage shows progress (Confirming premium, Submitting application, Redirecting). The portal collects no card or bank details; the backend redirects to the payment provider as the live site does. |
| 6. Payment result page (#6) | ✅ Built, 🟡 verification not connected. `payment-result.html` has success, pending, failed, cancelled, "could not confirm" and "nothing to check" states, each with recovery actions and support details. Success is shown **only** when the backend confirms the payment. |
| 7. End-to-end journey | ✅ Tested in the browser: sample mode for step-to-step continuity, and a fake backend for the live payment path (10.5). |

### 10.2 Sources (live portal, `home.min.js` and markup, reviewed 23 Nov 2026)

| Item | Live behaviour | Used here |
|---|---|---|
| Summary amounts | Individual: Total Premium = `reviewPage.individual.total_individual_renistatment_premium`, Discount = `…discount` (or `calculated.discount`), Nett = `total_premium_after_discount`, SST = `tax_amount`, Stamp Duty = `stamp_duty`, Final = `total_premium`. Establishment: Total = `medical_establishment.individual_original_premium`; components `individual_premium`, `individual_pic_premium`, `clinic_package_premium`. | Same mapping, in `parseQuoteResponse()` |
| Currency | `premium.model.country.amount_sign` | Must be RM/MYR; anything else is rejected |
| Payment options | `payment_option_type`: `credit_card_payment` (pre-selected on live) or `business_payment` | Both kept; no pre-selection, so the choice is explicit |
| Checkout | `/api/updateProposerInformation` (whole form). `{error:"error"}` means the start date is no longer valid. Then `/api/sendFinalPageEmail` (not awaited), then a hidden form POST to `{APP_URL}/doPayment` with `quotationNumber` and `_token`. The server redirects to the gateway. | Same sequence, in `payment-service.js` |
| Declaration encoding | Checkbox ticked (`1`) = "Agree" for individual Q1 and "Yes" for the others (from the live change handlers). Clinic route: `medical_establishment_*`, with `medical_establishment_answers` shared by Q1–3 and `medical_establishment_criminal_charges_desc` for Q4. | Same encoding |
| Result pages | Rendered by the live server after the gateway; no JSON status API in the client | **Not available.** A status contract is proposed (10.3) |

### 10.3 Payment verification (needs the backend)

The result page never trusts URL parameters as proof. It reads the quotation number saved when payment started (or a URL parameter) and asks the backend for the status. The endpoint is configured with `<meta name="ds-payment-status-path">` in `payment-result.html`; it is empty, so the page shows "We could not confirm your payment" and tells the customer not to pay again.

Proposed response for that endpoint: `{status: "paid"|"pending"|"failed"|"cancelled", quotationNumber, transactionReference, amount, plan, insuranceStartDate, insuranceEndDate, email, paidAt}`. "paid" is accepted only with a transaction reference, an amount above zero, and the same quotation number this browser paid for. Anything else counts as not confirmed.

### 10.4 Duplicate-payment and stale-quote protection
- The Proceed button is disabled while working and ignores repeat clicks. A page restored from the back/forward cache is reset.
- When payment starts, the quotation number is saved in this tab. Returning to the Summary shows "Payment already started" with a link to check the status. Paying again needs explicit confirmation.
- A confirmed failure or cancellation clears that record; success clears it together with the saved application.
- Immediately before payment the premium is recalculated. If the amount or quotation number changed, payment stops and the new amount is shown.
- Every step is revalidated before payment, including the start date, which cannot be in the past.

### 10.5 Verification
- Unit tests: **108/108** (13 new in `tests/payment.test.mjs`). `npm run check` passes.
- Browser (headless Edge, temporary QA pages, deleted afterwards): **141/141**.
  - **Sample journey:** Coverage → Quotation → Personal → confirmation popup (TIN shown) → Declaration → Summary. The same final amount appears on the Quotation, the Summary table and the action bar. There is no TIN, and the NRIC is masked. All breakdown rows are present with no hardcoded rates. Amounts are right-aligned and the final amount is emphasised. Browser Back/Forward work. A missing method is blocked, and sample payment leads to the result previews.
  - **Unconnected build:** no amount and no zero; Proceed is disabled with an explanation. The result page never shows success.
  - **Live path against a fake backend:**
    - the backend's amounts are shown; triple-clicking gives one recalculation, one submission and one gateway hand-off carrying the quotation number and token
    - the attempt is remembered, and returning shows the duplicate warning; a second payment needs confirmation
    - a changed price blocks payment and shows the new amount
    - a rejected start date stops payment with a clear reason
  - **Live result page:**
    - verified paid shows the reference, amount, period and email, and clears the draft
    - "paid" for another quotation or without a reference is not confirmed
    - pending, failed and cancelled each behave as designed, and "Check again" re-queries the status
  - **Layout:** no horizontal overflow on the Summary or the result pages at 8 widths from 320 to 1280px.
- **Bugs found and fixed while testing:**
  - The "payment already started" notice depended on the premium, which loads later, so it never appeared.
  - The warning result card shared a class name with the warning box and overflowed on mobile.

### 10.6 Files changed in Phase 4

| File | Change |
|---|---|
| `dist/payment-service.js` (new) | Payment methods, application request, gateway hand-off, payment status parsing, attempt record; unconnected/live/preview services |
| `dist/payment-result.html`, `payment-result.js`, `payment-result-view.js` (new) | Result page and its states |
| `dist/quote-service.js` | Shared live client (one CSRF session for quotation and payment), live summary field mapping, currency and consistency checks, `samePayable()` |
| `dist/premium-components.js` | `summaryBreakdown()`; rate labels removed |
| `dist/app.js` | New Summary page, payment flow, live premium updates on the Summary, NRIC masked, payment method migration from older drafts |
| `dist/icons.js` | `clock` and `alert` icons |
| `dist/product-compositions.css` | Summary, breakdown, payment options and result page styles |
| `tests/payment.test.mjs` (new), `tests/premium.test.mjs` | Phase 4 tests |
| `package.json`, `README.md` | Check script and module notes |

### 10.7 Missing provider integrations and items to confirm
1. **Backend connection:** `ds-api-base` is empty in `index.html` and `payment-result.html`. Nothing is submitted or charged until it is set; both pages need the same value.
2. **Payment status endpoint:** none exists in the live client. Agree on the contract in 10.3 and set `ds-payment-status-path`.
3. **Gateway return URL:** the backend must return customers to `payment-result.html`, and the names of any parameters it adds must be confirmed (the page accepts `quotationNumber`/`quotation` and `reference`/`ref`).
4. **Supported payment methods:** both live methods are kept. Please confirm with the payment provider that both are still supported.
5. **updateProposerInformation:** confirm its success response, the format of `branch_details` and `is_tin_number`, and whether the clinic route also needs the `clinic_package_*` fields.
6. **Establishment Total Premium:** the live client uses `individual_original_premium` for this row. Confirm it includes the clinic and PIC premiums.
7. **Wording approval:** the result-page and payment messages are new (no approved copy exists). The insurer should approve the success, pending, failed and cancelled text and the policy-delivery statement.
8. **SST and commission rates:** no longer printed. If the rate must be shown, the backend should return it.

---

## 11. Phase 5: Renewal, Claims, final audit and production readiness

### 11.1 Renewal and Claims mobile verification (#7)

**Root cause of #7.** The old Renewal/Claims screens:
- accepted only numbers in the form `01x…`
- printed "+60" *under* the field, where it read like a value
- used a stub OTP session that had no backend contract.

**What was built** (`otp-service.js`, `services.js`, `services.css`):

| Area | Result |
|---|---|
| Phone format | Taken from the live system: mobiles are stored as digits without `+60` and without the leading 0 (the application form saves `customer_phone = 1*value`, and the OTP forms show a `+60` label beside a digits-only field). Customers may type `012 345 6789`, `0123456789`, `+60 12-345 6789`, `60123456789` or `123456789`; all become `123456789`. The same rule as Personal Particulars is used, so any number that could be registered is accepted. "+60" now sits inside the field. |
| Renewal | `/api/renewFormOtpSend` {phoneNumber, selectedType: sms/whatsapp}, then `/api/formRenewOtpVerify` {user_id, phoneNumber, otpValue}. Outcomes: one policy or a list (renewal links, restricted to `my-individualindemnity.doctorshield.com`); "no records" shows the approved live message and Get a Quote; a wrong code shows the approved live message. |
| Claims details | `/api/claimFormOtpSend`, then `/api/claimFormOtpVerify` (single or multiple record). For several policies the customer picks one, which is loaded with `/api/getSingleRecordInMultiple`. The insured name, email, phone and policy number are prefilled (name and policy number are read-only). The 4-part claim form is followed by a review with uploads (PDF, Word, Excel or image, up to 6 MB each). The claim is sent to `/api/sendClaimsEmail` (multipart). |
| Claim confirmation | A claim counts as received **only** when the server returns its confirmation-page URL on the DoctorShield domain; the customer is then sent there. Any other response shows "Claim not confirmed" and removes the Submit button, to avoid a duplicate claim. |
| Initial Claims Discussion | Same send step, then `/api/initialClaimFormOtpVerify`. A verified number gets the "Book An Appointment" link (Microsoft Bookings, new tab), as on the live site. |
| SMS and WhatsApp | Both channels, as on the live site (`selectedType`). |
| Expiry and resend | The countdown follows the live timers (3 minutes for renewal and claims, 4 for a discussion). Resend is offered when the code expires, as on the live site. |
| Retry limits | Up to 5 wrong attempts per code, then a new code is required; up to 3 codes per visit, then the customer is asked to contact us. **These are client-side only. The server must enforce real rate limits.** |
| Loading and errors | Buttons show "Sending…" or "Verifying…" and are disabled while busy. Errors appear next to the field and in a live region. |
| Privacy | The number is masked on the code screen (`+60 ••• 6789`). Send failures show one neutral message, so the page never repeats a server message that might reveal whether a number is registered. |
| Unconnected build | "This service is not available yet". No code is sent and nothing is confirmed. |

Removed: the old `ServiceSession`/`mobileNumber` stub and `preview-api.js` (replaced by `otp-service.js` preview mode, with sample code `123456`).

### 11.2 Design audit (every page, 320 to 1440 px)

**Fixed:**
- Renewal/Claims rebuilt in the design system:
  - centred single column, page title and intro
  - 3-step verification progress
  - option cards for the two claim routes and for picking a policy
  - one progress indicator on claim screens (two used to stack), with a "Step x of 5" caption
  - actions stack on mobile
  - the sidebar that repeated the header links is removed
- Button labels made clear: "Message OTP"/"Whatsapp OTP" became "Send code by SMS"/"Send code by WhatsApp".
- Sidebar step labels ("Step 2", "02") raised from 3.67:1 to about 5.8:1 contrast.
- Checkboxes enlarged from 22 to 24 px. Error-summary links and small text buttons now have a 24 px minimum target.
- Leftover `.service-option` styles removed.

**Reviewed, no change needed:** header, footer, sidebar stepper, Coverage, Quotation, the email-sent screen, Personal Particulars and its confirmation popup, Declaration and both legal popups, Summary, payment result states.

**Known, not changed:** the sidebar introduction video is an external Cloudflare embed. Where it cannot load (as in the offline test browser) the box shows plain teal. A poster image fallback could be added if wanted.

### 11.3 Accessibility (target: WCAG 2.2 AA)

Automated audit of 18 page states (headless Edge with focus emulation). Every state passes:
- every input has a label, and every button or link has an accessible name
- every image has alt text, IDs are unique, and there is one `h1` per page
- text contrast is at least 4.5:1 (3:1 for large text)
- interactive targets are at least 24×24 px; links inside sentences use the WCAG inline exception
- a visible focus style on the first 30 focusable controls of each state

Also tested:
- the mobile menu (aria-expanded; Escape closes it and returns focus)
- Enter submits the mobile and code steps
- dialogs trap focus and return it

**Not done:** screen-reader testing (NVDA, VoiceOver, TalkBack) and a manual audit by an accessibility specialist. The automated checks cannot prove AA conformance, so **no WCAG compliance is claimed**.

### 11.4 Security and reliability review

| Area | Finding | Status |
|---|---|---|
| Secrets | No keys, tokens or credentials in frontend code. The CSRF token is fetched per session from `/api/getCSRFToken`. No environment variables are used; backend addresses are public `<meta>` settings. | ✅ |
| Security headers | There were none. `vercel.json` now sets a Content-Security-Policy (scripts from this site only; no inline scripts exist), `nosniff`, `X-Frame-Options: SAMEORIGIN` / `frame-ancestors 'self'`, a Referrer-Policy, a Permissions-Policy and HSTS. `server.mjs` applies the same headers locally, and all browser suites pass under the policy with no violations reported. | ✅ Added. **`connect-src` must include the production API origin**, and a `form-action` rule should be added once the payment gateway domains are known (left out so it cannot block the gateway redirect). |
| Authentication | Customers are identified by OTP to a registered mobile. Authorisation (which policies or claims a verified number may see) is entirely server-side. | ⚠️ Server responsibility, not verifiable here |
| Session expiry | The application draft is kept in `sessionStorage` for 6 hours, in that tab only. It is cleared after a verified payment and by "Clear application". OTP state lives only in memory. | ⚠️ The draft holds NRIC, date of birth, TIN, income and declaration answers. Shared computers are a risk; decide whether to shorten the 6 hours or leave the NRIC/TIN out of the draft. |
| Input validation | Every form is validated on the client using the live rules. | ⚠️ The server must validate again; client checks are not security. |
| API errors | Timeouts (20 s), HTTP errors, unreadable responses and offline cases all give a clear message and a retry where it is safe. | ✅ |
| OTP abuse | Client-side attempt and send limits; neutral error messages. | ⚠️ **The server must rate-limit** sends and verifies per number, per IP and per time window, and must not reveal whether a number is registered. |
| Payment | No card data is collected. Success needs backend verification; duplicate-payment guard; premium recalculated before payment (Phase 4). | ⚠️ The status endpoint does not exist yet (10.3) |
| Duplicate submission | Busy states on every submit; payment attempt record; claim submit removed after an unconfirmed attempt. | ✅ |
| Stale quotes | Pricing key and recalculation before payment (Phases 2 and 4). | ✅ |
| Uploads | Type and size checked on the client. | ⚠️ The server must check file type and content, size and malware. |
| Logging | The frontend has no `console` logging and no analytics, so no personal data is logged by the client. | ✅ Server logging policy not reviewed |
| Dependencies | No npm packages or third-party scripts, so there is no client supply-chain exposure. | ✅ |
| Publicly served legacy files | `styles.css`, `refined.css`, `responsive-check.html`, `illustration.js`, `assets/ds_logo.svg`, `insurance-guide.png`, `physician-portrait.*` are unused. `design-system.html` is an internal component library. | ⚠️ Recommend removing them from the deployment (needs approval; not deleted) |

### 11.5 Tests performed (final run, 23 Nov 2026)

| Suite | Result |
|---|---|
| Unit tests (`npm test`) | **115/115** (new: `otp.test.mjs`, 12 tests) |
| Syntax check (`npm run check`, now covers every module) | **27/27** modules |
| Phase 5 browser suite: Renewal/Claims on the live code path (fake backend) and the unconnected build; keyboard; accessibility audit (18 states); overflow at 320/375/414/768/1024/1440 px for 7 key states | **95/95** |
| Team-review regression, one check per issue | **22/22** |
| Phase 4 suite: full purchase journey, live checkout with a fake backend, result pages, layout | **141/141** |
| All browser suites under the production CSP | 0 violations reported |

**Customer journeys covered:**
- successful purchase (sample and live path)
- email quotation (sample, unconnected)
- failed payment then recovery (the attempt is cleared and the application kept)
- price change before payment
- renewal (one policy, several policies, none, wrong code, lockout)
- claims (one or several policies, form, uploads, submit confirmed and not confirmed)
- claims discussion
- form recovery (errors, then correction, then continue)
- navigation (Back/Forward, Edit, then Continue)

**Not tested:** real backend, staging or sandbox, real SMS or WhatsApp delivery, the real payment gateway. None were available or authorised. No real customer data was used.

### 11.6 Files changed in Phase 5

| File | Change |
|---|---|
| `dist/otp-service.js` (new) | Renewal/Claims/discussion verification, record selection, claim submission (live, unconnected, preview) |
| `dist/services.js`, `services.css`, `services.html` | Renewal and Claims rebuilt; `ds-api-base` setting added |
| `dist/service-model.js`, `api.js` | Old OTP stub removed; claim phone uses the shared mobile rule |
| `dist/personal-rules.js` | Accepts `60…` typed without the `+` |
| `dist/quote-service.js` | Shared client supports multipart uploads |
| `dist/shell.css`, `application.css`, `product-compositions.css` | Contrast, target sizes, dead styles removed |
| `dist/preview-api.js` | Deleted (replaced) |
| `vercel.json`, `server.mjs` | Security headers in production and locally |
| `check.mjs`, `package.json` | `npm run check` covers every module |
| `tests/otp.test.mjs` (new), `services.test.mjs`, `preview.test.mjs` | Updated |

---

## 12. Final release-readiness report

### 12.1 The 14 review issues

| # | Issue | Status |
|---|---|---|
| 1 | Email quotation | 🟡 Built and tested. Needs the email API with explicit confirmation |
| 2 | 12-month premium | 🟡 Built. Figure comes from the quotation API (`oneyearpremium`) |
| 3 | TIN on Summary, TIN popup | ✅ Done |
| 4 | Negative declaration explanations | ✅ Done |
| 5 | Premium on Summary | ✅ Done; figures come from the quotation API |
| 6 | Payment success page | 🟡 Built. Success needs the payment status endpoint |
| 7 | Renewal/Claims mobile number | ✅ Done in the frontend; 🟡 OTP and claim services need connecting |
| 8 | Patients and income mandatory | ✅ Done |
| 9 | Footer | ✅ Done |
| 10 | Summary like the live site | ✅ Done |
| 11 | Remove Policy Documents section | ✅ Done |
| 12 | Header | ✅ Done |
| 13 | No unintended redirects | ✅ Done within the portal (Back/Forward, steps, new tabs for external links). Intentional hand-offs remain: payment gateway, server renewal page, server claim confirmation, Microsoft Bookings |
| 14 | Different popup content | ✅ Done |

### 12.2 Additional issues found and fixed (all phases)

- **Phase 2:**
  - quotes were not detected as stale when pricing inputs changed
  - setting the backend address to `/` was treated as "not connected"
- **Phase 3:**
  - typed explanations were saved in the wrong place
  - Edit did not return to the NRIC field
- **Phase 4:**
  - the "payment already started" warning never appeared
  - a result card overflowed on mobile
  - the "25% commission" and "SST 8%" labels were hardcoded
- **Phase 5:**
  - Renewal and Claims rejected valid registered numbers
  - "+60" was printed under the field
  - two progress bars appeared on claim screens
  - step-label contrast, checkbox size and error-link size
  - there were no security headers

### 12.3 Screens and flows implemented

- Coverage, Quotation (premium panel, add-ons, email or buy), email-sent, Personal Particulars plus confirmation popup, Declaration plus two legal popups, Summary (breakdown and payment).
- Payment hand-off; payment result (success, pending, failed, cancelled, not confirmed, nothing to check).
- Renewal (mobile, code, policy or no records).
- Claims (route choice, mobile, code, policy choice, 4-part form, review and uploads, submit) and claims discussion (booking).
- Sample/review mode for every screen.

### 12.4 Verified backend integrations

**None have been verified against a real backend.** All contracts were taken from the live portal's client code, and each one is tested against a fake backend that follows that code. Items marked `VERIFY` in the code and listed in 8.4, 9.7, 10.7 and below need backend confirmation.

### 12.5 Remaining blockers

1. **Backend connection:**
   - set `ds-api-base` in `index.html`, `services.html` and `payment-result.html`
   - choose between serving from the API origin, a proxy, or CORS with credentials (8.4 item 5)
   - add the origin to the CSP `connect-src`
2. **Staging environment** to accept every flow end to end without creating live records.
3. **Payment status endpoint** and gateway return URL (10.3, 10.7).
4. **Backend confirmations:**
   - specialisation field IDs, yes/no encoding and the clinic-route fields (8.4, 10.7)
   - phone-number format for OTP lookups; real OTP expiry and rate limits
   - the claim record field name (`user_claim_quote_number`)
   - whether `/api/sendClaimsEmail` validates and scans uploads
5. **Server-side controls:** OTP rate limiting, re-validation of all input, upload scanning, authorisation of policy and claim lookups.

### 12.6 Needs business or insurer approval

- Wording on the payment result screens and the policy-delivery statement (10.7 item 7).
- The split of the two legal popups (9.7).
- The 1 July end-date rule (8.2).
- TIN field kept or removed once the server lookup is connected (9.7).
- Patients/income minimums (9.7).
- Both payment methods still supported (10.7).
- Support contacts: the approved "no records" message names WhatsApp **+60 12-293 0700** and query@thedoctorshield.com, while the rest of the portal uses **+60 12-536 0700**. Please confirm which number is correct.
- Re-locking later steps after an earlier edit (section 5).
- Removal of the legacy and internal files (11.4).
- Draft retention of NRIC/TIN for up to 6 hours (11.4).

### 12.7 Deployment readiness

- **Configuration:** static files from `doctorshield/dist` on Vercel (Root Directory `doctorshield`). There is no build step; security headers are in `vercel.json`.
- **Ready:** the frontend code, tests and headers.
- **Not ready:** backend settings are empty, so in production every premium, OTP, claim and payment would show "not available yet". That state is safe but not usable.
- **Not deployed.** Nothing was deployed in any phase.

### 12.8 Recommendation

**No-go for a production release**, because:
- no backend integration has been verified
- payment success cannot be confirmed (there is no status endpoint)
- server-side controls have not been reviewed.

**Go for the next stage:** deploy to a staging or preview URL connected to a staging backend, run user acceptance testing for every journey in 11.5 with test numbers and sandbox payments, get the approvals in 12.6 and close the blockers in 12.5. Then repeat the test suites against staging before a production decision.

---

## 13. Design refinement (after Phase 5)

Scope: Renew, Claims and form validation first; then consistency fixes across the application. Skills used: `better-interface` (review method), `better-accessibility` (validation pattern). The other domain skills were not loaded, so typography, colour and motion were not formally reviewed.

| Area | Change |
|---|---|
| Renew and Claims | One focused panel per step. The step title is the page heading, with a small "Step x of y" label, one primary action and quiet Back links. The repeated page header is removed. The mobile step has one field and an SMS/WhatsApp switch (default SMS) instead of two competing buttons. The code step shows the masked number with "Change number", a "new code in m:ss" countdown that becomes "Send a new code", and attempts left inside the error. Claims steps are numbered consistently (verification 1–2, claim 1–5), each claim step has a one-line explanation of what is needed, and the review says a claim is registered only on the confirmation page. Uploads use a labelled "Add files" control. |
| Form validation | The page-level error banner is removed. Errors show under each field with a red border (no pink fill), `aria-invalid` and `aria-describedby`. On submit, focus moves to the first invalid field and a polite message says how many fields need attention. A field with a value is checked when the customer leaves it, and errors clear as soon as they are corrected. A page notice appears only if an error has no field on screen. Claim and OTP errors were rewritten to name the field. |
| Removed clutter | Icons in section headings and the coverage summary, the sidebar illustration and the introduction video (CSP `frame-src` is now `'none'`). The sidebar keeps the plan name, steps and a short guide link. |
| Smaller fixes | The liability hint no longer repeats its error. The declaration explanation panel is neutral instead of warning-yellow. Copy tightened in Declaration, Quotation and Summary (approved and legal wording unchanged). |
| Motion | A 180 ms fade when moving between steps, only on step change. It is switched off by the existing reduced-motion rule. |

**Verification:**
- Unit tests 115/115 and `npm run check` 27/27.
- Browser suites, re-run after updating them for the new markup and wording: Phase 5 95/95, review issues 22/22, Phase 4 141/141, with no CSP violations reported.
- The automated accessibility audit (18 states) and overflow checks (320–1440 px) are included and pass.
- Visual review at 375, 768 and 1100–1440 px.

**For approval:**
- The rewritten OTP error ("That code is incorrect…") replaces the live "The OTP you have entered is wrong, Please check.". The "no records" message keeps the approved wording.
- Removing the introduction video from the sidebar.

---

## 14. Functional completion and QA tools

### 14.1 Flows checked

The Coverage, Quotation (premium), Buy now, Email quotation, Personal Particulars, Declaration, Summary, checkout/payment, payment result, Renewal and Claims flows were each exercised in the browser:
- in test mode through the simulated services
- on the live code path against a fake backend that follows the live portal's contract.

**Bug found and fixed:** the Personal Particulars email rule had lost its escape characters (`[^s@]` instead of `[^\s@]`), so **any email address containing the letter "s" was rejected** on that step. It was hidden because the old test address had no "s". The rule is fixed, a regression test is added, and a scan of every regular expression found no other lost escapes.

**Not verified against real services:** no backend, sandbox or credentials are configured. Every live integration (premium, promo, TIN, email, application submission, payment hand-off, payment status, renewal/claims OTP, claim submission) is unverified; see section 12.5.

### 14.2 Test mode and QA panel

| Item | How it works |
|---|---|
| Gate | `dist/dev-mode.js`. Test mode needs `<meta name="ds-qa" content="enabled">`. **A query parameter alone no longer enables anything**: `?sample=1` used to switch on sample journeys on any deployment, and now it only works when the flag is present. |
| Who adds the flag | The local dev server (`server.mjs`, default; `--no-qa` serves pages exactly as in production) and `npm run build:staging` (`build.mjs --qa`), which must only be deployed behind access protection. |
| Production | `npm run build` (now Vercel's build command, output `public/`) leaves out `dist/qa/` and all `_qa*` files and strips any flag. Without the flag the loader does nothing; without the folder there is nothing to load. |
| Simulation | Test mode uses the preview services only (no network). Outcomes are switched per scenario (`quote`, `email`, `checkout`, `otpSend`, `otpVerify`, `claimSubmit`). Simulated results are labelled on screen ("Test mode" ribbon, "Sample" badges, "No email was sent"). Live services ignore scenarios. |
| QA panel (`dist/qa/`) | A floating **QA** button opens a non-modal panel (Escape closes it and returns focus) with four tabs:<br>• **Go to** every implemented screen. Renewal review/result are shown disabled with the reason: they are server pages.<br>• **States** for the current page (empty, partial, valid, required errors, invalid format, loading, calculating, calculated, failed, timeout, expired, email ready/sending/sent/failed, payment ready/processing/method missing/checkout failed/premium changed, result pages, OTP waiting/invalid/expired/locked/limit/rate-limited, unavailable, no policy, several policies, claim form/errors/review/not confirmed/submitted).<br>• **Scenarios**: 14 one-click journeys.<br>• **Tools**: three synthetic personas (Malaysian NRIC, Singaporean passport, clinic owner with add-ons), fill current page, fill the whole journey, reset form, reset test session, and a state readout. |
| Data | `dist/qa/fixtures.js` holds invented people and numbers only. The panel shows no tokens or identity numbers. |

The inline review toolbars ("Interface review") are replaced by the panel.

### 14.3 Tests

| Suite | Result |
|---|---|
| Unit (`npm test`): adds `qa-gating.test.mjs` (gate, production and staging builds, simulated outcomes, fixtures) and the email regression | **123/123** |
| `npm run check` (now includes `dist/qa/`) | **30/30** modules |
| `npm run build` | Production build: no `qa/`, no flag |
| QA panel browser suite: navigation, cross-page commands, states, scenarios, personas (each passes every step's validation), reset, no network calls from a simulated purchase | **41/41** |
| Phase 5 suite (live-path Renewal/Claims, accessibility audit, overflow) | **95/95** |
| Review-issue regression | **22/22** |
| Phase 4 suite (purchase journey, checkout, results) | **141/141** |
| Production-mode browser probe (`server.mjs --no-qa`): `/?sample=1`, `services.html?…&sample=1`, `payment-result.html?sample=1&status=paid` | No QA button, flag or API, no simulated content; the result page says "We could not find a payment to check" |

### 14.4 Deployment change (for approval)

`vercel.json` now runs `node build.mjs` and publishes `public/` instead of `dist/`. Nothing has been deployed.
