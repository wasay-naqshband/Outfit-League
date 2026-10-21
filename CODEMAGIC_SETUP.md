# Codemagic iPhone beta

The owner selected Codemagic on October 20, 2026. **The signed iPhone build and upload succeeded.** Apple processed version **0.1.0 (106)**, and the private **Owner beta** group shows Testing with one build and one tester. With explicit permission, only wasayiqbal2@gmail.com was added; status is Invited. Automatic future-build distribution is off. No external review or public release was submitted. Actual iPhone installation/testing remains outstanding.

Successful build: https://codemagic.io/app/6ad744a36c8ebd66ea4e0b38/build/6ad77411454d2506f7ab7624 . App Store Connect app ID: **6824954866**. Its record was created with explicitly approved Full Access. The saved beta information explains sample shopping and AI fit limitations.

Signing completed with explicit owner authorization: group group.com.outfitleague.app (UY43C3TMB3), main identifier LKSRJ5R23N and extension identifier BL6Q2HPR2L. Both belong to team 3HWMTPBM6W and share the group. Main profile HKH374RZ49 was regenerated and extension profile PGXZP7JDBP created using existing certificate 23V6GC697U, expiring October 20, 2027. Codemagic references: outfit-league-main-groups, outfit-league-share, Outfit League certificate. No API key was created and no certificate revoked.

Fixes pushed: aa5bded matches the existing Apple integration name Codemagic; c53c6bf explicitly selects both refreshed profiles; 57d1e79 replaces the preinstalled pnpm launcher on the disposable runner. The first configured attempt passed signing but failed installing pnpm; the retry passed checks, CocoaPods, signing, archive/export and upload.

Signed artifact: release/Outfit-League-TestFlight-106.ipa. Audit: release/testflight-106-audit.json, including SHA-256, both target versions/identifiers, team/group checks and absence of actual private server secret values. Evidence: qa/testflight-build-106-testing.png and qa/testflight-owner-invited.png.

GitHub: https://github.com/wasay-naqshband/Outfit-League, currently **Public**. Codemagic app ID: 6ad744a36c8ebd66ea4e0b38. The tracked-file scan found no private environment/signing files or actual private server secret values. Private visibility is supported and remains an owner choice. Account is Personal and billing remains disabled; builds consume the free allowance.

## Free account and repository

Use a **Personal** account, `mac_mini_m2`, and keep billing disabled. Personal accounts currently include 500 M2 minutes per month, reset on the first; Team accounts do not. The workflow starts manually and has a 60-minute timeout. Failed builds may consume minutes. Verify the actual allowance in the account before starting.

The existing Git repository contains this project and `codemagic.yaml`. Private visibility is recommended and supported but has not been selected by the owner. Never upload `.env`, `supabase/.env.server`, signing keys, diagnostic logs, release archives or account data. Public `EXPO_PUBLIC_*` values in the workflow are intended to ship with the app. Backend functions remain on Supabase; their private environment must never be added to Codemagic.

## Apple setup

Apple login now works in the owner's Incognito browser. Use that session for owner-controlled steps; do not copy browser cookies or passwords.

1. Verify the active Apple membership and correct team, completing any agreements yourself.
2. Register/verify `com.outfitleague.app` and `com.outfitleague.app.expo-sharing-extension`. Both need App Groups capability and membership in `group.com.outfitleague.app` for incoming shares.
3. Create the Outfit League iOS record in App Store Connect with `com.outfitleague.app`, version `0.1.0`. Record its numeric app ID. Never create a second app record merely to retry a build.
4. Create a dedicated App Store Connect team API key for Codemagic with the documented App Manager access. Download the private `.p8` once and store it privately. This grants signing/publishing access: the owner must approve or perform the security grant. Never paste the key in chat or commit it.
5. The existing Developer Portal key reference is **`Codemagic`** and the YAML now matches it. Reuse it; do not create another key. Keep the private key in Codemagic's protected integration, not in the YAML.
6. Add a matching Apple Distribution certificate with its private key and **App Store** provisioning profiles for both targets to Codemagic's signing identities. Codemagic can generate/fetch them using the integration; new credential creation requires owner approval. Do not revoke existing certificates to make room without checking their users.

## Build and TestFlight

Scan the private repository for `codemagic.yaml` and select **Outfit League iPhone beta**. Verify free M2 usage and start one build manually. The workflow uses pinned Node/pnpm, locked dependencies, typechecks/tests, Expo prebuild, CocoaPods and Xcode archive/export. It does not call EAS Build or require an Expo access token.

The main Xcode scheme/workspace is expected to be `OutfitLeague`; native generation/compilation must confirm this on the Mac runner. Incoming sharing remains enabled and requires both profiles; do not remove the extension to hide a signing error.

Build numbers start at `100 + PROJECT_BUILD_NUMBER`. This is appropriate for this project's first iOS uploads. If an existing App Store build has a higher number or the Codemagic project is recreated, adjust the offset before uploading. The guard stops above 9899 rather than silently creating an invalid first version component.

On successful archive, publishing uploads the IPA to App Store Connect for processing. It **does not submit for external TestFlight review or App Store review**, select tester groups, or release publicly. Once processing completes, configure beta information and internal testers in App Store Connect. A signed IPA upload alone is not a successful TestFlight installation. Use BETA_RELEASE.md for phone acceptance and privacy review.

## Verification limits

Windows can validate the workflow structure and application source, but cannot run Xcode or verify Apple signing. A successful Mac archive and an actual iPhone installation are still required. No paid service is enabled by this file.

Official references:

- https://docs.codemagic.io/billing/pricing/
- https://docs.codemagic.io/yaml-quick-start/building-a-react-native-app/
- https://docs.codemagic.io/yaml-publishing/app-store-connect/
