# DoctorShield Individual Indemnity

Local frontend with five application stages, conditional clinic/PIC cover, branch editing, declarations, review and supporting dialogs. Plain JavaScript ES modules; no framework or build dependency.

## Run

From this folder, run npm run dev. The default port is 4173. If that port is occupied, use PowerShell: $env:PORT='4174'; npm run dev. Open http://127.0.0.1:4174/ for the server used in this workspace.

## Verify

npm run check (check.mjs) syntax-checks every module in dist. npm test checks validation, all six clinic/PIC terminal routes, classification rules, draft recovery and shared controls. Open /design-system.html for the component reference. ?sample=1 and ?review=1 expose local sample journeys and screen inspection controls. Use Fill sample details; service OTP is 123456. Renewal and claims previews use services.html?flow=renewal&sample=1 and services.html?flow=claims&sample=1.

## Architecture

- tokens.css: brand, semantic colors, typography, spacing, motion and geometry (single source of truth).
- application.css: foundations and shared atoms (fields, selection, buttons, feedback, dialogs).
- product-compositions.css: insurance compositions (cards, quotation, add-ons, premium bar, review).
- shell.css and shell.js: header, mobile menu, layout, sidebar stepper, mobile progress and footer. Loaded last on every page.
- components.js: native input, select, radio-group and consent atoms.
- ui.js: shared buttons, section headings and status notices.
- app.js: screen composition, navigation and local interaction state.
- clinic-rules.js, catalog.js and validation.js: independent business rules and validation.
- draft.js: six-hour sessionStorage draft scoped to a browser tab, with graceful storage failure.
- content.js: source notices, declarations and supporting copy.
- api.js: explicit unconnected service boundary.
- personal-rules.js: name, date of birth, NRIC/passport, mobile, patients, income and TIN rules, taken from the live portal.
- payment-service.js: payment methods, application submission, hand-off to the payment gateway (no card data is collected) and verification of the payment status. Unconnected by default.
- payment-result.html / payment-result.js / payment-result-view.js: the payment result page. It shows success only when the backend has verified the payment.
- otp-service.js: Renewal and Claims mobile verification (SMS/WhatsApp), policy lookup and claim submission, using the live portal contract. Unconnected unless ds-api-base is set in services.html.
- services.js / services.css: the Renewal and Claims pages.
- coverage-rules.js: start-date limits and 31 December end-date rule, taken from the live portal.
- quote-service.js: quotation backend adapter (limits, promo, premium, quotation email). Unconnected unless <meta name="ds-api-base"> in index.html is set; ?sample=1 uses labelled preview data.

## Backend boundary

No real premium is calculated, application submitted, OTP/email delivered or payment initiated. Real payment remains disabled; sample mode offers explicitly simulated outcomes. The 22-classification catalog is a public-source snapshot, not authoritative server underwriting. Final eligibility, premiums, dynamic policy wording, expiry, backdating/renewal and recovery require integration and acceptance testing.

Generated portrait assets are retained on disk but are not used in transactional screens. Earlier migration scripts and legacy styles are historical; do not rerun them. Entry points load fonts.css, application.css, product-compositions.css, page styles (services.css) and then shell.css. refined.css and styles.css are unused legacy files.

See ../docs/DEVELOPMENT_PROGRESS.md for the current audit, review-issue mapping, phase status and integration blockers.


## Vercel deployment

vercel.json sets the security headers (Content-Security-Policy, nosniff, frame protection, Referrer-Policy, Permissions-Policy, HSTS), and server.mjs applies the same headers locally. When connecting the backend, set the same ds-api-base in index.html, services.html and payment-result.html, and add the API origin to the CSP connect-src.

The portal is a static multi-page site. Set the Vercel Root Directory to doctorshield; its vercel.json publishes dist. (There is no repository-root vercel.json.) Both explicitly disable framework autodetection, install and build commands. Do not run server.mjs on Vercel: it is only the local preview server.

Production entry points: /, /design-system.html and /services.html. Use /?sample=1 for simulated journeys. No backend credentials are required for the frontend.
