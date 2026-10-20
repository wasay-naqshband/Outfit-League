# When you are back

## Latest: Milestone 10 beta preparation

Update: Apple login works in Incognito. The owner selected Codemagic instead of Expo cloud builds. The manual M2 workflow is ready in codemagic.yaml; follow CODEMAGIC_SETUP.md. Codemagic Personal signup is pending in the opened tab; keep billing disabled. Private repository and Apple signing integration are still needed before the first build. No Codemagic build or TestFlight upload has run.

Keyboard adjustments and native foreground status refresh are implemented. The current source passes 44 tests, TypeScript/format checks, and web/Android/iOS exports. See BETA_RELEASE.md for the TestFlight text and uncompleted physical iPhone checklist; PRIVACY_REVIEW.md is a factual owner-review draft.

Two blockers remain: Apple identity verification needs checking in normal Safari/Chrome, and Expo's free iOS build quota is exhausted until November 1, 2026. No iOS cloud job, signed IPA, TestFlight upload or paid upgrade was created. The owner can choose to wait, use an available Mac with Xcode, or review paid Expo options. Milestone 10 is not complete. The older Android APK predates these latest source changes. No new website deployment was made for this milestone.

The historical updates below include earlier access requests that have since been resolved. Urban Outfitters US now shows Pending (applied); it has not approved the application or granted feed/native-image permissions.

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
