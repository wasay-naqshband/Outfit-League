# Milestone 8 — account control and launch readiness

Implemented: Settings links to profile/account controls, support, privacy and a protected administrator report view. Support is wasayiqbal2@gmail.com, as supplied by the owner. Final policy review remains outstanding.

## Deletion

The account screen requires the exact word DELETE and password re-entry. The server verifies the user and a session created within ten minutes, then atomically marks deletion pending, unpublishes every owned battle, removes the account's hashed battle votes and queues both deterministic battle snapshot paths. Active try-ons block the request without deleting anything. An owner lock and write guards prevent racing job/battle/library writes from restoring access.

Restrictive RLS policies deny existing tokens access to all private owner tables and Storage. Edge functions also reject pending-deletion accounts. The account is banned from new sign-ins. Already issued image URLs can last up to five minutes; downloaded copies cannot be revoked. Provider-held copies follow that provider's retention and are not claimed to be deleted by this feature.

The existing private reconciliation worker processes deletion after 130 minutes, allowing two-hour signed upload tokens and in-flight requests to expire. It removes all objects under the owner prefix in tryon-private/library-private, including unreferenced uploads, then queued battle snapshots and any racing account votes, then deletes the Auth user and cascaded app data. Errors retain the durable queue and retry on the next tick. At most five accounts, 500 objects per bucket and 100 battle paths are processed per tick; larger collections continue on later ticks. The account cleanup endpoint also supports a worker-secret-only reconcile action without AI reconciliation.

Queue tables are server-only. Operators can inspect account_deletions.requested_at/attempts for delayed cleanup. Queues are removed after success. Do not delete private metadata before file cleanup has completed.

## Profile and moderation

Display names persist in the owner-only profile and prefill the public vote form. Visibility consent is always unchecked. Existing public votes retain their consented snapshot name; deleting the account removes account-linked votes. Self-chosen names do not establish verified identity.

Administrator membership is stored only in the server-managed moderators table. No user metadata, email comparison or client flag grants access. An operator must explicitly insert the intended existing user UUID; authenticated users cannot read or write the role table. The administrator endpoint checks membership and active account state on every request. The UI shows the latest 50 private reports and can open the corresponding public battle or confirm hiding it. Hiding is audited and idempotent; old image URLs expire within one minute. Wider moderation workflow and report pagination can be added as reporting volume grows.

The owner explicitly approved administrator access for wasayiqbal2@gmail.com. The operator verified its existing confirmed active account, appointed it through the server-only role table, and verified the report view opens successfully. Ordinary-user denial was captured before appointment; separate disposable ordinary/admin accounts verified server authorization. Disposable fixtures were removed after testing. The operator utility is scripts/appoint-moderator.cjs and requires an exact confirmed email plus private CLI authorization.

## Native testing

EAS project: https://expo.dev/accounts/wasaynaqshband/projects/outfit-league (9815ed89-c0d6-45eb-aec9-b4c8e3c2a7c2). Preview profile produces an Android APK and iOS ad hoc build; simulator profile is also supplied. Only public Supabase configuration is included in eas.json. Server sources, private environments, logs, fixtures, release files and signing files are excluded by .easignore. The archive inspection contained zero server/QA files and no private secret values; excluded folder placeholders were empty.

The first Android build failed before compilation because the default Node 20 image could not run pnpm 11 (node:sqlite missing). Preview now pins the locally verified Node 24.19.0. Retry: https://expo.dev/accounts/wasaynaqshband/projects/outfit-league/builds/90aedaa5-d794-4c8f-ae92-df306239880f . Final status must be recorded after completion. No paid plan or store submission was requested.

The owner confirmed an active Apple Developer Program membership and App Store Connect access, and selected iPhone/TestFlight testing. The testflight build profile uses store distribution and increments the build number. A noninteractive attempt confirmed that iOS signing credentials are not yet configured for either com.outfitleague.app or its expo-sharing-extension target. The owner must complete Apple sign-in/2FA and signing setup in the interactive build launcher Start-iPhone-TestFlight.cmd; passwords/codes never belong in chat. This builds only, without App Store submission. SecureStore's documented usesNonExemptEncryption=false configuration is supplied for the app's OS-provided encryption (https://docs.expo.dev/versions/latest/sdk/securestore/#exempting-encryption-prompt).

Actual phone testing remains required. Use a disposable account for deletion; never delete the owner's account to test it. On Android and iPhone check: cold start/sign-in restoration; email confirmation and recovery on the same device; camera/gallery allow/deny/limited access; text entry with keyboards; incoming screenshots/links; explicit AI consent and one-credit accounting; background/reopen during generation without repeat submission; native sharing; public battle links/vote consent; offline/retry; deletion confirmation/cancel and disappearance of shared battles. Real generation is an explicit owner action that uses a credit. iPhone installation requires Apple signing and device registration or TestFlight; a JavaScript export is not device acceptance.

## Verification

44 Node tests, two Deno image-conversion tests and four server function typechecks pass. Account tests apply the actual migrations to isolated PostgreSQL. They cover owner-only profile updates, protected roles/deletion RPC, administrator rejection/authorized hide/audit, stale sessions, active job refusal, old-token denial, immutable deletion state, vote removal, queued paths and cascading metadata removal.

25 hosted account checks passed with disposable accounts and original sample fixtures: a real owner-authenticated nested library upload, try-on private file and battle snapshot were removed by the actual deployed worker; Auth and app data were deleted and the queue cleared. No real-user account, photo, AI credit or payment was changed. Logs: qa/milestone-8-tests.log, qa/milestone-8-hosted.log. Physical device acceptance is not yet claimed.

Android retry 90aedaa5-d794-4c8f-ae92-df306239880f finished successfully. The installable APK is recorded in release/android-preview.json and downloaded to release/Outfit-League-preview.apk. This proves Android native compilation, not physical-device acceptance. iPhone signing is being completed interactively by the owner; no iOS build or TestFlight upload is claimed yet. The common Page scroll view now adjusts iOS keyboard insets and dismisses the keyboard on drag, for confirmation and sign-in forms; actual iPhone behavior still needs verification.

The downloaded APK is 92,960,030 bytes and contains AndroidManifest.xml, compiled DEX, arm64 native libraries and the bundled JavaScript. SHA-256 is recorded in release/android-preview-audit.json. The owner supplied a screenshot of Apple authentication failing with an internal server error before iOS build submission. Apple Developer live status listed account, signing and App Store Connect services as available; EAS CLI 25.2.0 matches the current registry release. Browser sign-in to Apple's own Developer site is awaiting owner completion to check account-specific notices. No iOS/TestFlight build is claimed.
