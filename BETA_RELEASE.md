# Outfit League — beta release pack

Prepared October 20, 2026. This records readiness and instructions, not a claim that TestFlight or physical-device testing has passed.

## Current build status

**iPhone beta is available in TestFlight:** version **0.1.0 (106)**. Codemagic build 6ad77411454d2506f7ab7624 finished successfully, Apple accepted the upload without errors, processing completed, and the private **Owner beta** group shows **Testing**. Only the explicitly authorized owner account, wasayiqbal2@gmail.com, is enrolled; Apple shows **Invited**. Automatic future-build distribution is off. No external beta review or public App Store release was submitted.

App Store Connect app ID: **6824954866**. Its distribution draft defaults to 1.0; the beta binary is 0.1.0. Beta description, feedback email and public app/privacy links are saved. Open Apple's invitation on the iPhone, choose View in TestFlight, accept and install Outfit League. The first physical-device installation and acceptance checks below are still **Not tested**.

Signed IPA: release/Outfit-League-TestFlight-106.ipa (14,351,647 bytes). Audit: release/testflight-106-audit.json. Both app components have matching version/build numbers and the correct team/shared group. No actual private server secret values were found in the IPA. Local source checks and native compilation do not prove runtime behavior on an iPhone.

Codemagic uses the Personal/M2 free allowance with billing disabled. The Expo quota and earlier Apple sign-in problem were bypassed by this approved route; no Expo upgrade, new API key or certificate revocation was needed. GitHub repository visibility is currently Public, as previously reported.

Android preview: https://expo.dev/accounts/wasaynaqshband/projects/outfit-league/builds/90aedaa5-d794-4c8f-ae92-df306239880f . APK: release/Outfit-League-preview.apk. It predates the Milestone 10 foreground-refresh and keyboard refinements.

## TestFlight information — ready for owner review

**Beta description:** Outfit League is an outfit-planning app in testing. Save inspiration, organize a private Closet, preview clothing with AI, and share two-look outfit polls. The shopping catalog currently uses clearly labeled sample products; retailer access is pending. AI previews are generated visuals and do not guarantee physical fit.

**What to test:** Test sign-in and email links on the same iPhone, camera and photo-library access, saving/editing Closet items, returning to a generation after backgrounding the app, native image sharing, and opening a battle voting link in Safari. Verify public voting asks permission to show your name and choice. Use a disposable account to test deletion. Report your iPhone model, iOS version, app build number and the steps that produced a problem. Do not include passwords, verification codes or private photos in feedback.

**Feedback email / support:** wasayiqbal2@gmail.com / https://chutni.store/support

**Current privacy information:** https://chutni.store/privacy . The fuller factual draft is PRIVACY_REVIEW.md and requires owner review before it is presented as the final notice.

**App Store Connect record:** 6824954866, created and verified. Owner-only internal beta invitation is issued. A dedicated review account and final disclosure/contact answers remain necessary before external beta review; never give reviewers the owner’s administrator password.

The existing testflight build profile produces a store-distribution IPA. Start-iPhone-TestFlight.cmd starts an interactive build only. Uploading to App Store Connect is a separate step after a signed build exists; it is not a public App Store release. Official process: https://docs.expo.dev/submit/ios/ . Do not submit a simulator archive to TestFlight.

## Actual iPhone acceptance

Record the device/iOS/build number and Pass, Fail or Not tested for every row. These rows are currently **Not tested**.

| Flow                        | Expected result                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold launch / relaunch      | Fonts and artwork load; correct signed-in account is restored.                                                                                            |
| Email confirmation          | A link requested from the app returns to that app on the same iPhone and completes sign-in.                                                               |
| Password recovery           | A newly requested link opens recovery on the same device; mismatches and expired links show recoverable errors.                                           |
| Camera permission           | Allow opens the camera; deny produces guidance and still permits choosing another source.                                                                 |
| Photo library / cancel      | Selected photos render correctly; cancellation leaves the previous selection untouched. Check iOS limited-library access.                                 |
| Keyboards                   | Sign-in, reset, Closet editing, public voting and deletion fields remain reachable. No duplicate keyboard spacing; drag can dismiss it.                   |
| Closet persistence          | Save/edit/reopen an item, relaunch, and verify the same private record and image.                                                                         |
| Explicit generation         | Only the owner-triggered Generate action with two images and consent submits photos. Note balance before/after.                                           |
| Background generation       | Start one authorized test, leave the app, reopen and resume the same job. No second submission/reservation; current status and balance refresh.           |
| Failure / offline retry     | A failed job refunds once. Offline views expose retry; reconnect and reopen recover without duplicate generation.                                         |
| Native sharing              | Share the generated result through the system sheet; cancel without error or unintended publication.                                                      |
| Incoming share              | Share an image/link into Outfit League, review it before saving; do not fetch restricted social content.                                                  |
| Battle privacy              | Draft stays private; only explicit publication shares its two selected snapshots.                                                                         |
| Guest / public voting       | Safari opens a public link; duplicate voting is rejected. Public mode requires sign-in, display name and unchecked-by-default visibility consent.         |
| Close / unpublish           | Voting stops or sharing ends as indicated; old image URLs may survive briefly.                                                                            |
| Account deletion cancel     | Typing nothing/wrong text or cancelling cannot delete.                                                                                                    |
| Disposable account deletion | Correct typed/password confirmation blocks access, unpublishes its battles, and durable cleanup eventually removes files/account. Never delete the owner. |
| Admin isolation             | An ordinary account cannot read reports or hide content. The appointed owner can review reports.                                                          |

Live generation consumes provider allowance and app credits: use an explicitly authorized test with images the tester has permission to submit. Automated tests in this workspace do not replace these checks.

## Current source refinements

- Page supplies iOS keyboard insets for ordinary forms. Screens already wrapped in KeyboardAvoidingView opt out to avoid overlapping adjustment.
- The existing native AppState listener now updates TanStack focusManager, so stale active queries refresh on foreground and polling pauses in the background. This refreshes existing jobs; it never calls the generation-start action.
- Private environments, server files, diagnostics and signing formats (.p8/.p12/.pem/keystore/provisioning profiles) are excluded from native archives. The inspected archive contained no server files, private-format files or actual private server secret values.

## Before a wider beta

Complete actual device acceptance, verify the Apple team and app record, review the privacy draft and age/territory/disclosure answers, and resolve any relevant UGC safety/review requirements. Keep shopping demo offers separate until retailer approval/feed permission is obtained. Payments and external analytics remain disabled. Do not mark Milestone 10 complete before a TestFlight installation and the core phone flows pass.
