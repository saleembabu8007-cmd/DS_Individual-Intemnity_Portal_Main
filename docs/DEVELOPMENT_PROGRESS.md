# DoctorShield Individual Indemnity Portal: Development Progress

| | |
|---|---|
| Product | Chubb Elite Medical Malpractice Insurance (Individual Indemnity) |
| Application | `doctorshield/` (static ES-module frontend, published from `doctorshield/dist`) |
| Current phase | **Phase 1 complete.** Audit, design system, header, sidebar and footer |
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
| 1 | "Email me quote page is not available" | `app.js` `case 'next'` → `boundary('emailQuote')` shows a "service not available" notice. No outcome page. `states.quoteSent` exists only as a review screen. | 2 (UI) and 5 (email integration) | Open |
| 2 | "Missing the 12 months premium amount" | `quotation()` has no "standard premium for a 12-month period" line. The live site shows "(ii) … standard premium for a 12 month period will be RM …". Needs a server value. | 2 | Open. Blocked on the quote API. |
| 3 | "Don't show TIN field in summary page. TIN number popup is missing." | `reviewScreen()` adds a "Tax Tin Number" row when filled. No TIN help dialog exists. | 3 | Open. **TIN popup wording needed.** |
| 4 | "Negative declaration textbox" | `declarations()` shows one shared textarea when any answer is adverse. Clarification needed: one textbox per adverse answer, or a change to the trigger/label? | 3 | Open. **Needs clarification.** |
| 5 | "Premium amount was not shown in summary page" | `reviewScreen()` has no premium section. The price appears only in the fixed action bar. | 3 | Open |
| 6 | "Payment success page is missing" | No success, failed or pending result screens (only sample-mode modals). `api.createPayment` is not connected. | 5 | Open. Blocked on the payment gateway. |
| 7 | "Which mobile number should I enter? Not accepted in renewal and claim flow" | `service-model.js` `mobileNumber()` requires `01x` Malaysian mobiles. The "+60" hint sits *below* the field and reads like a value. The tester entered `4567876567`. | 4 | Open |
| 8 | "Number of patients and income fields mandatory, not optional" | `personal()` passes `optional:true`. `validatePersonal()` does not require `patients` / `revenue`. | 3 | Open. Needs a business-rule change. |
| 9 | "Footer content is only terms and conditions and privacy policy" | `index.html` / `services.html` footer | **1** | ✅ **Done** |
| 10 | "I need a summary page just like the one on the current site" | `reviewScreen()` layout. The current site has plan, classification, period, auto-reinstatement, coverage table, then total/discount/nett/SST 8%/stamp duty/final premium, then payment option. `premiumBreakdown()` already provides the table component. | 3 | Open |
| 11 | "Remove this policy document section and the popup related to this" | `quotation()` `.quote-documents` block, and `case 'documents'` dialog. `declarations()` links "Policy Wording" / "Product Disclosure Sheet" to the same dialog. | 2 | Partly done: removed from the sidebar and footer in Phase 1. Quotation section and dialog still open. |
| 12 | "Change the whole header" | `index.html` / `services.html` header, `shell.css`, `shell.js` | **1** | ✅ **Done** |
| 13 | "Page should not be redirected anywhere" | Steps were not in browser history, so Back left the portal. Renew/Claims are separate pages. Editing earlier steps re-locks later ones. | **1** (start), 3–4 | 🟡 **In progress.** See section 5. |
| 14 | "Important notices and declaration and authorization show the same popup" | `declarations()`: both buttons use `data-action="declaration"`, which opens `disclosureHtml` (Important Notices). | 3 | Open. **Declaration and Authorization wording needed.** |

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

## 8. Next phase

Phase 2 has **not** been started. Before it begins, confirm:

1. The proposed issue-to-phase mapping in section 3.
2. Answers to the open questions: #4 (negative declaration textbox), section 5 item 2 (re-locking steps), and the deletion of legacy files.
3. Availability of the TIN popup and "Declaration and Authorization" wording, and the quote API contract.
