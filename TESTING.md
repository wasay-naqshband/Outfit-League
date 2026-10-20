# Milestone 1 verification

## Build checks

- Strict TypeScript: passed.
- Expo dependency compatibility: passed with the SDK's pinned React Native and Reanimated versions. The check used bundled version metadata in offline mode.
- Production export: iOS and Android Hermes bundles and web JavaScript generated successfully. Build output is recorded in qa/production-build.log.
- Formatting: check script provided.

Bundling is not a substitute for testing on iOS and Android devices.

## Browser interaction checks

Tested with the in-app browser against the local production preview:

- Welcome launches and guest browsing opens Explore.
- Exactly four tabs navigate in the specified order.
- Category filtering changes feed content.
- Search produces the matching/empty state; clearing restores the feed.
- Outfit detail preserves the selected look into Try On and its sample result.
- Local save changes state and appears in Closet → My Closet.
- Before/After changes the illustration and selected segment.
- Shop the Look opens from the result. Similar and Budget change sample prices. Exact reports that there are no verified matches.
- Compare prices expands a labeled illustrative comparison.
- Battle A/B selection changes the border, sticker and chosen-state label.
- Unavailable uploads, live voting links and credits have explicit preview explanations.

## Visual checks

References and production screenshots are compared at 390 × 844 CSS pixels, device density 1. The qa folder contains paired captures and side-by-side comparison images.

A 320 × 568 viewport check identified heading and label overflow. Compact title/credit/label handling fixes those issues while preserving touch targets. Content scrolls with bottom padding behind the floating navigation.

## Manual native checks still needed

On iOS and Android, check safe areas, gesture/back navigation, keyboard avoidance, screen readers, font scaling, native shadows, native share sheets, cold launch and auth-session restoration. With a Supabase test project, verify sign-up confirmation, sign-in, error handling, reset-email delivery and sign-out. Complete native callback/recovery routing before claiming full authentication support.

## Milestone 2

Eighteen local tests now cover credit accounting, job idempotency, submission claims, ownership, storage isolation, refunds, durable request limits, JPEG/body validation, provider response mapping and secure session storage. Seventeen hosted integration checks verify real authentication, private signed uploads, RLS, credit reservation/refund and deletion. The hosted tests create and remove temporary accounts and never send emails or AI requests.

The deployed security advisor has no warnings. The reconciliation endpoint responds successfully and the scheduled job runs successfully. Native device tests and real-user/provider acceptance remain. Public voting and retailer integrations are still deferred.

## Milestone 3

The private Closet replaces the former sample collection. Add/edit/delete, link-only imports, screenshot/photo imports, tags/notes, search over loaded pages, paginated older items and saved-garment handoff are implemented. AI Looks connects existing generated history.

Verification: 28 local tests, two Deno image-conversion tests, and 16 hosted library checks. Hosted checks create/remove temporary accounts and exercise actual uploads, owner-only access, editing, source-only imports, fresh-access denial after deletion and cleanup queuing. No AI calls or email are involved.

At 390 × 844, browser QA imported supplied sample artwork with a link, refreshed to verify persistence, edited tags while preserving the photo, searched by tag, and loaded the saved photo into Try On. Generate remained disabled without a person photo and consent. Native introspection confirms the Android share intent and iOS App Group; actual share sheets require device testing. See MILESTONE_3_SETUP.md.
# Milestone 4 verification

32 local tests and 15 hosted Explore checks pass. Hosted checks use disposable accounts and send no emails or AI requests. Catalog pagination is tested with 30 local fixtures and multiple hosted cursor pages. Search checks include results beyond the first page, combined style filters, brands/tags, literal punctuation and unpublished-row isolation. Concurrent saves return one private snapshot; foreign accounts cannot read it or forge its catalog identifiers. Credits remain untouched.

Browser acceptance at 390×844 passed: search/filter, empty/reset, details, private save, full page reload, Closet listing, sample metadata editing, and both garment handoffs. Generate remained disabled without the person photo and consent. The owner's two-credit balance did not change. One labeled Navy bomber sample is left saved for review. Screenshots: `qa/milestone-4`. Final web/iOS/Android exports pass (`qa/milestone-4-build.log`); native device execution remains unverified.

# Milestone 5 verification

38 local tests, 34 hosted battle checks, TypeScript/Deno checks and web/iOS/Android bundle exports pass. Hosted tests use disposable accounts and sample fixtures; no emails, purchases or AI calls. Tests cover owned source selection, private drafts, consent to publish, concurrent duplicate votes, anonymous name suppression, public identity/visibility consent, private storage/raw-table denial, snapshot-only exposure, completed-result-only copying, reports, moderation hiding, close/unpublish and unchanged wallets. Temporary hosted accounts, records and images are removed.

Browser acceptance at 390×844 passed both voting modes, private preview, publish consent, vote persistence after reload, public name visibility consent, named results, close/unpublish and story instructions. QA used supplied illustrations; both disposable UI battles were unpublished and removed with their dummy votes. One private sample draft remains for owner review. The app is now live at https://chutni.store with HTTPS, public guest voting, reload persistence, named results, production auth-callback return and bundled assets verified. Temporary public QA accounts/battles were removed. Native device share sheet and clipboard checks remain outstanding. Evidence: `qa/milestone-5/`, `qa/milestone-5-tests.log`, `qa/milestone-5-hosted.log`, `qa/milestone-5-build.log`.

## Current combined Milestones 6–7 checks

The current Node test runner reports **40 tests passing**, plus **two separate Deno image conversion tests**. This is the current reproducible count; earlier milestone counts above are historical reports. TypeScript and Deno checks pass. Web, iOS and Android exports pass; physical-device behavior remains unverified.

Thirteen hosted shopping checks pass: bounded ordered pages, literal search, currency/budget filters, empty exact demos, protected writes/proof/click logs, and blocked demo/unknown outbound requests. No test accounts, purchases or AI calls are required. The real user's local two-credit balance stayed unchanged.

Credit accounting is tested against the actual migration, including replayed grants/reservations/claims/completion/refunds and RLS. Analytics rejects unknown values, strips undeclared properties and tolerates provider failures; its default singleton has no sink. The purchase adapter rejects every attempt while unconfigured.

Release acceptance on October 20, 2026: the combined web update was published to Netlify deploy `6ad7146c3808a999db01f07b` and verified at https://chutni.store/shop?look=navy. Direct route loading, fonts/icons/garment assets, Similar/Budget results and absence of browser error logs passed. The audited export contains 39 files, no environment files or actual private server secret values. Netlify's hosting badge is supplied by the hosting service.

Local browser acceptance covered both 320px and 390px phone layouts, private Closet → Shop → Navy source with metadata prefill, category changes with cleared search, comparison expansion, strict budget boundary/invalid input, Exact empty state, demo disclosure and completed-AI-look metadata-only browsing. Credit activity displayed the actual welcome/reserve/consume history, with no second completion charge; credit packs were disabled. Privacy information loaded. No Generate, purchase, real user photo publication or external retailer action was taken. Evidence: `qa/milestone-6-saved-shopping.png`, `qa/milestone-7-credit-activity.png`, `qa/milestone-7-credit-packs.png`, `qa/milestone-7-live-shopping.png`, combined test/build/server/image logs and `release/hosting-audit.json`.

## Current Milestones 8–9 checks

The current reproducible suite reports **44 passing Node tests**. Four Edge Function typechecks and TypeScript/Prettier checks pass. Actual-migration account tests include active-job refusal, recent session requirements, private profile permissions, denied client role grants/deletion RPC, authorized moderation/auditing, pending-deletion old-token denial and cascades. Catalog tests include approval requirements, complete atomic snapshots, expiry/unavailability, removed offers, and private approval metadata.

**25 hosted account checks pass**, using disposable accounts and original fixture photos only. Verified actual Auth deletion, try-on private bytes, owner-authenticated nested library bytes, separately queued battle snapshot bytes, old-token denial and queue completion. No emails, real-user deletion, AI generation, purchase or credit change. Thirteen hosted catalog regression checks still pass; no invented live products were inserted into production.

Web/iOS/Android JavaScript exports passed. Local 390px browser verification passed profile/control layout, disabled deletion without confirmation/password, cancel, ordinary-user administrator denial, support address, sample/USA catalog separation and the truthful pending-feed empty state. These checks are not actual-device acceptance. Native cloud build status is recorded separately in MILESTONE_8_SETUP.md.

Published web deploy: `6ad71ee410ad6566fc1323b5`, October 20. Live Settings → Contact support was verified at https://chutni.store; direct routes and assets load and the hosting badge remains disabled. The audited production ZIP contains 39 static files, no environment files and no private server secret values. Evidence: qa/milestone-8-account.png, qa/milestone-8-admin-denied.png, qa/milestone-8-live-support.png, qa/milestone-9-us-catalog.png, qa/milestone-8-tests.log, qa/milestone-8-hosted.log, qa/milestone-9-hosted.log and release/hosting-audit.json.


Android native build 90aedaa5-d794-4c8f-ae92-df306239880f finished successfully after pinning Node 24.19.0. Installable APK: release/Outfit-League-preview.apk. iOS/TestFlight signing remains an owner-interactive step. A subsequent iOS-only keyboard-inset adjustment typechecks; it has no Android-specific behavior and must be verified on the iPhone build. Native compilation and JavaScript exports do not replace actual-device acceptance.

## Milestone 10 beta preparation — October 20

Current source: 44 Node tests, TypeScript and formatting pass; web/Android/iOS exports succeed. Evidence: qa/milestone-10-tests.log, qa/milestone-10-format.log and qa/milestone-10-build.log. Native source archive audit found no server files, private formats or actual private server secret values (release/milestone-10-archive-audit.json). No physical iPhone checks have passed yet. Apple verification and the exhausted free Expo iOS quota block a signed build/TestFlight; no simulator cloud job was created. See BETA_RELEASE.md for exact acceptance steps and current build limitations.

