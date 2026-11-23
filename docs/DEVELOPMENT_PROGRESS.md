# DoctorShield Individual Indemnity Portal: Development Progress

| | |
|---|---|
| Product | Chubb Elite Medical Malpractice Insurance (Individual Indemnity) |
| Application | `doctorshield/` (static ES-module frontend, published from `doctorshield/dist`) |
| Current phase | **Phase 3 complete.** Personal Particulars, validation, confirmation popup, Declaration. Phase 2 is complete pending backend connection; Phase 1 is complete. |
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
| 5 | "Premium amount was not shown in summary page" | `reviewScreen()` has no premium section. The price appears only in the fixed action bar. | 3 | Open |
| 6 | "Payment success page is missing" | No success, failed or pending result screens (only sample-mode modals). `api.createPayment` is not connected. | 5 | Open. Blocked on the payment gateway. |
| 7 | "Which mobile number should I enter? Not accepted in renewal and claim flow" | `service-model.js` `mobileNumber()` requires `01x` Malaysian mobiles. The "+60" hint sits *below* the field and reads like a value. The tester entered `4567876567`. | 4 | Open |
| 8 | "Number of patients and income fields mandatory, not optional" | `personal()` passes `optional:true`. `validatePersonal()` does not require `patients` / `revenue`. | 3 | ✅ **Done.** Both are mandatory whenever the classification asks for them. Patients must be a whole number of up to 8 digits. Income must be an RM amount with up to 2 decimals, and is formatted on blur. |
| 9 | "Footer content is only terms and conditions and privacy policy" | `index.html` / `services.html` footer | **1** | ✅ **Done** |
| 10 | "I need a summary page just like the one on the current site" | `reviewScreen()` layout. The current site has plan, classification, period, auto-reinstatement, coverage table, then total/discount/nett/SST 8%/stamp duty/final premium, then payment option. `premiumBreakdown()` already provides the table component. | 3 | Open |
| 11 | "Remove this policy document section and the popup related to this" | `quotation()` `.quote-documents` block, and `case 'documents'` dialog. `declarations()` links "Policy Wording" / "Product Disclosure Sheet" to the same dialog. | 2 | ✅ **Done.** Section and dialog removed. Policy Wording disclosure line kept (with a link when the quote supplies `policy_wording_pdf`). The declaration's Product Disclosure Sheet is now a direct PDF link. |
| 12 | "Change the whole header" | `index.html` / `services.html` header, `shell.css`, `shell.js` | **1** | ✅ **Done** |
| 13 | "Page should not be redirected anywhere" | Steps were not in browser history, so Back left the portal. Renew/Claims are separate pages. Editing earlier steps re-locks later ones. | **1** (start), 3–4 | 🟡 **In progress.** See section 5. |
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

## 10. Next phase

Phase 4 has **not** been started. Open decisions:

1. Confirm the **1 July end-date rule** (section 8.2).
2. Backend items in section 8.4, plus a staging API so the premium, 12-month figure, promo, TIN lookup and email can be accepted end to end.
3. Items in section 9.7.
4. Earlier questions still open: re-locking of steps after edits, and deletion of legacy files.
