# When you are back

## Latest: October 21 — build 109 and web update

**Settings is reachable from every tab** (gear button), grouped into Account / Try On / Help & privacy, shows the app version, and shows Administration only when the server confirms moderator access (commit a28491d).

**iPhone:** build 107 was installed on the owner's iPhone 15 Pro (iOS 26.6.1), so TestFlight installation works. Codemagic build #9 produced **0.1.0 (109)** from a28491d. The manual "Owner beta" group was replaced by **Owner auto**, an internal group with automatic distribution: every new upload reaches the owner's TestFlight once Apple processes it. Builds are still started manually in Codemagic. The physical-device checklist in BETA_RELEASE.md is still outstanding.

**Web:** chutni.store updated via Netlify CLI (deploy 6ad873a34ee14747a08f82ce) and verified (gear button, version label). The CLI is now logged in on this PC: `pnpm export:web`, then `netlify deploy --prod --dir dist --site willowy-bienenstitch-cd3e0f`.

The sections below are older and may be superseded by the above.

## Milestone 10 beta preparation

**Install the iPhone beta:** Apple has invited wasayiqbal2@gmail.com to the private Owner beta TestFlight group. Open the invitation on the iPhone, choose View in TestFlight, accept and install **Outfit League 0.1.0 (106)**. Tell us whether it opens and provide the iPhone model/iOS version. Do not send passwords or codes.

Codemagic build 6ad77411454d2506f7ab7624 succeeded. Apple upload and processing completed; the group shows Testing, one build, one tester, and the owner shows Invited. Signing, app-group registration and App Store Connect Full Access setup were explicitly approved and completed. App ID: 6824954866. No public release, external testers or automatic future-build distribution. Billing remains disabled.

The signed IPA and audit are in release/Outfit-League-TestFlight-106.ipa and release/testflight-106-audit.json. Both components have matching version/build numbers and the correct shared group; no actual private server secret values were found. See BETA_RELEASE.md for the still-uncompleted physical iPhone checklist and CODEMAGIC_SETUP.md for build details. Milestone 10 is not complete until device acceptance passes.

GitHub repository is currently public; private visibility is supported. Urban Outfitters US remains Pending (applied), with no approved feed or native/AI image permissions. Final privacy review is still needed. No new web deployment was made for this native build.

The historical updates below may describe earlier setup states; the current status above takes precedence.

Latest October 20 update: account/profile controls, support and protected report review are implemented and published in deploy 6ad71ee410ad6566fc1323b5. Deletion was verified only on disposable accounts, including actual private file cleanup. Your account is preserved. USA/USD shopping import and stale-offer controls are ready; the USA catalog deliberately has no live offers until a permitted retailer feed is provided. See MILESTONE_8_SETUP.md and MILESTONE_9_SETUP.md for current acceptance limits.

Administrator wasayiqbal2@gmail.com is now explicitly approved, appointed and verified. The owner selected iPhone/TestFlight testing and Urban Outfitters/Rakuten for the first US feed. Expo was already authenticated and the app is now registered for native preview builds. No paid plan or store submission was made. Final privacy wording and physical-device acceptance remain required.

Apple Developer Program/App Store Connect membership is confirmed. Remaining input: complete interactive Apple signing through Start-iPhone-TestFlight.cmd and finish signing into Rakuten Advertising in the opened tab. Urban Outfitters explicitly advertises a product feed on https://www.urbanoutfitters.com/help/affiliate . Registration and retailer/feed approval must be completed by you. The owner has started registration; the agent has not submitted personal information or an application. For Rakuten's country field use genuine publisher/payment details, not the target shopping country; its signup guide describes this as the country where commission will be received.

The October 20 update is live at https://chutni.store. Closet → Shop opens the sample shopping flow. Profile → Your try-on credits → View credit activity opens the private ledger. Your balance remains at two available credits.

Completed independently: sample catalog/search/category/budget/comparison flow, saved-source shopping, guarded retailer-link foundation, credit history, disabled credit-pack preview, disabled analytics foundation, privacy information, automated checks and web deployment. No purchase or new AI generation was made. No new account or paid plan was opened.

## Choices and access needed next

1. **Real shopping:** choose the first country/currency and retailers. A permitted catalog/feed is needed for real images, prices, stock and links. Until then, sample products are clearly labeled and cannot be purchased. Affiliate programs are optional.
2. **Payments:** decide credit pack amounts/prices and which platforms launch first. Apple/Google developer accounts and the chosen receipt service must be connected by you. Purchases stay disabled until verified receipts, replay protection, refunds and store sandbox tests are implemented.
3. **Launch readiness:** support contact is supplied, account-wide deletion is implemented and the administrator is appointed. Review final privacy terms. The factual privacy explanation does not replace final policy review.
4. **Phone testing:** use iPhone/Android to check auth confirmation/recovery, camera/gallery permissions, incoming shares, result sharing and battle links. Build exports passed, but no physical device has been tested by the agent.
5. **Optional analytics:** choose whether to add it. It is currently off and sends no events.

The existing domain can be replaced later by updating DNS, the public app origin and allowed auth/server origins, then rebuilding and verifying old/new links. No new domain is needed for the current test release.

Technical details and validation are in MILESTONE_6_SETUP.md, MILESTONE_7_SETUP.md and TESTING.md.

Android preview build finished successfully: https://expo.dev/accounts/wasaynaqshband/projects/outfit-league/builds/90aedaa5-d794-4c8f-ae92-df306239880f . Local APK: release/Outfit-League-preview.apk. iPhone attempt is blocked at Apple's internal login error before build submission; the owner is signing in to the official Apple Developer browser page to check account notices. Do not keep retrying passwords without resolving that step.

Rakuten account is now verified and the publisher dashboard opens. Urban Outfitters US MID 43176 supports Product Catalog, but status is Not partnered. Review the open retailer terms before applying; downloadable app use requires case-by-case approval and retailer content modification requires written approval. No application or message has been submitted. The next gate is explicit approval of the retailer agreement and subsequent advertiser/feed permission.

Urban Outfitters US application is now submitted with explicit owner authorization; Rakuten shows Pending (applied). Await the retailer's review. Do not import products or use retailer images for native/AI features until the required permissions and feed access are granted. Submission evidence: qa/urban-application-submitted.png.
