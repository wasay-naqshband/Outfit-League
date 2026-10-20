# Milestone 5 — Battles and share-link voting

## Implemented

- Authenticated creators select two different images from private Closet/inspiration or completed AI looks. A draft previews the exact two copied images privately. Creating battles uses no AI credits.
- Publishing requires an explicit permission checkbox. Only the selected images are copied to a separate private battle bucket. Original person/garment inputs, private source IDs, Closet names and other saved items are not returned to visitors. AI results and sample illustrations are labeled.
- Voting mode is selected before draft creation and cannot be changed by the client. Anonymous battles permit guest voting and display totals without voter names. No submitted display name is stored for anonymous votes. Public battles require sign-in, a self-chosen display name, and explicit consent to show that name and choice to anyone with the link. Names are not verified identities, and account emails are never copied into votes.
- One immutable vote per battle/account key or guest browser key. Concurrent repeated requests count once. Anonymous browser identifiers are persisted locally; account/browser keys are hashed server-side. Basic per-network and per-voter hourly limits apply. Clearing browser data or using other devices/accounts can bypass basic guest duplicate prevention; this is not fraud-proof voting.
- Totals, percentages, ties, leading fit, recorded choice and paginated public voter lists. Results refresh every 45 seconds and on demand. Public voter pages contain 40 names; owner battle lists use cursor pages of 20.
- Owner can close voting (results stay visible) or unpublish (new visitors lose access). There is no client action to republish a closed/unpublished/hidden battle. Existing image URLs expire within 60 seconds; already downloaded images/screenshots cannot be recalled. Unpublishing retains the private owner record and its battle snapshots.
- Link copy and system share controls use EXPO_PUBLIC_APP_URL. Story sharing provides a copyable voting URL and instructions to add a screenshot and Link sticker in the user's social app. The app does not auto-post stories or connect social accounts.
- Reports enter a private moderation queue. A server operator can list reports and hide published/closed battles using `scripts/moderate-battles.cjs list` and `hide EXACT_BATTLE_UUID`. This uses the existing local CLI authorization; no moderator credential is shipped in the app. Authors cannot remove reports or unhide a battle. Reports are not reviewed automatically, and broad public discovery is deferred until moderation is staffed.
- Ten draft creations per account per day. Incomplete snapshot uploads can be retried with the same draft identifier. Image objects are immutable once copied, including retries.

## Backend

Migration `202610190005_battles.sql` and Edge Function `battles` are deployed. All battle writes, counts and votes go through the function. RPCs are restricted to service_role. Only creators can select their own raw battle rows; raw votes, reports, rate-limit rows and image storage are not readable by clients. The function validates JWTs itself and supports guest reads/votes without treating publishable keys as user identity.

Network addresses are hashed with the existing private worker secret for abuse limits; raw network addresses are not stored in battle tables. Only gateway network headers are used as an additional limit. Rate-limit rows older than two days are pruned during writes. Reports are deduplicated by network. Storage and Edge Function usage remain subject to the Supabase plan.

## Live deployment

The app is live at **https://chutni.store** on Netlify project `willowy-bienenstitch-cd3e0f`. HTTPS is enabled for both `chutni.store` and `www.chutni.store`; www redirects to the primary domain. Hostinger remains the registrar/DNS provider. The domain previously served a parking page; only the root A record (2.57.91.91 → 75.2.60.5, TTL 300) and www CNAME (chutni.store → willowy-bienenstitch-cd3e0f.netlify.app, TTL 300) were changed. Existing email records were preserved. No hosting purchase or paid upgrade was performed.

Supabase production site/confirmation/recovery redirects and backend CORS origins are configured for the domain and Netlify fallback, preserving local/native redirects. The local `.env` now contains the public app URL, enabling real share URLs in the local preview too. Private keys were not uploaded to Netlify.

Live acceptance passed: direct guest battle URL, anonymous vote and reload persistence, public display-name/choice list with guest sign-in requirement, and production authentication callback returning a disposable account to its original battle. Clipboard APIs are restricted in this embedded browser, so Copy now times out gracefully and exposes a selectable voting URL as a fallback. Story instructions use that same public link. Physical phone share sheets and actual social story posting remain manual checks.

Disposable live test battles, votes, callback file and test account were removed, and the public site was signed out from the temporary test account. The owner's real local session and private review draft were preserved. Live screenshot: `qa/milestone-5/live-explore.png`.

Manual uploads initially skipped nested package/dot directories used by Expo fonts. `scripts/flatten-web-assets.cjs` fixes this by flattening hashed asset files and rewriting their exact bundled web URLs. Run it after web export and before packaging; fonts/icons/images are now verified on the public site.

`release/outfit-league-chutni-store.zip` contains only the domain-configured static web export. `release/hosting-audit.json` verifies the production URL, SPA fallback, absence of environment files and absence of private server secret values. These are ignored build outputs. Netlify Free supports custom domains/SSL with a monthly usage hard limit; see [current plan documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/). Deployment does not require publishing repository source or buying Hostinger hosting.

The app can use a different domain later without moving battle/vote records. Previously shared links continue working only if the old domain remains accessible and redirects to the replacement.

### Future release procedure

1. Inspect hosting and existing domain content before any upload. Preserve an existing site, or choose an approved subdomain/free host if the root is occupied. Do not overwrite unrelated files or upgrade a paid plan without the owner's approval.
2. Deploy only the web export contents to the selected site's public root. Never upload source, `.env`, `supabase/.env.server`, scripts or CLI credentials. `public/.htaccess` provides SPA route fallback on Hostinger Apache/LiteSpeed; `public/_redirects` supports compatible static hosts. Hostinger's official documentation describes [website types](https://www.hostinger.com/support/1583214-how-to-add-a-website-in-hostinger/) and [public_html/.htaccess](https://www.hostinger.com/support/1583307-how-to-create-an-htaccess-file-at-hostinger/).
3. Keep EXPO_PUBLIC_APP_URL set to the current HTTPS origin `https://chutni.store`, or change it when deliberately migrating domains. Rebuild with a cleared Metro cache after an environment change. Run the asset-flattening and private-secret audit before packaging only the web export. The release export remains separate from the local preview.
4. Add the actual HTTPS origin to ALLOWED_ORIGINS, preserving local origins; deploy private secrets through the CLI without displaying them. Add production auth callback/recovery URLs to Supabase Auth and verify confirmation redirects on that same device/browser. Keep existing local/native redirects.
5. Verify HTTPS, direct refresh of `/battle/UUID`, auth callback and assets. Then test a newly published sample battle from an independent browser/device, guest anonymous voting, signed-in public voting, Copy Link, system sharing and Link sticker handoff. Until this passes, external sharing is not claimed complete.

## Verification

- 38 local tests pass: existing functionality plus owned-source requirements, private drafts, publish readiness, anonymous name suppression, duplicate votes, public identity/consent enforcement, close/unpublish, private reports, moderation hiding and rate limits.
- TypeScript and Deno checks pass. Web/iOS/Android JavaScript/Hermes exports pass. Native device installation and physical share-sheet/clipboard testing remain outstanding.
- 34 hosted integration checks pass using disposable accounts and permitted sample fixtures, with no emails, purchases or AI API requests. They verify guest privacy, public/anonymous voting, photo snapshot copying, completed-result-only copying, explicit consent, raw-table/storage denial, moderation, close/unpublish and unchanged credit balances. Temporary accounts and their records/images are removed.
- Browser acceptance at 390×844 covers source selection, private preview, disabled Publish before consent, anonymous voting and reload persistence, close/unpublish, public voting disabled before visibility consent, named results and story instructions. Both disposable UI test battles were unpublished and then removed with their dummy votes. One new **private draft** titled “Your first sample battle” is left for owner review; the extra Green varsity sample remains in Saved inspiration. No real-user photo was published by QA and no AI credit was used.

Evidence: `qa/milestone-5/`, `qa/milestone-5-tests.log`, `qa/milestone-5-hosted.log`, `qa/milestone-5-build.log`.
