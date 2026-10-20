# Milestone 2 setup and verification

## Connected project

Project reference: xxrylsmiaehgnljyzguh. Public connection configuration lives in the ignored root .env file.

The database migration, authenticated try-on Edge Function, private image bucket, auth redirect URLs, server-side worker secret and one-minute reconciliation schedule have been deployed.

Genlook is connected and enabled for explicit user Generate actions. Its key was verified through the read-only credit endpoint, which showed 10 credits at setup; the owner subsequently reported completing a try-on. Automated Milestone 3 checks do not generate images.

## Private server configuration

The ignored file supabase/.env.server contains the server configuration. TRYON_PROVIDER=genlook selects the current adapter; GENLOOK_API_KEY stays server-only, never in the root client .env. The owner supplied the key, its starter balance was verified and LIVE_TRYON_ENABLED was set to true. For a new provider/account, leave the switch false until its balance and credentials have been verified. Automated checks use no generation credits.

Genlook documents 10 starter API credits. This is a signup allowance, not a recurring free tier. Check the balance in its dashboard; do not enable automatic top-ups for this trial. The adapter sends multipart photo bytes, requests one-day input/output and product retention, keeps the AI label, and downloads the hosted result into private storage. Provider-hosted copies follow its retention policy; deleting local history does not immediately remove them. Completed results are accepted only from the documented storage.googleapis.com host, bounded to 8 MB and normalized from JPEG/PNG to JPEG. An unexpected host or unsupported output fails safely. We still need actual output-quality and runtime acceptance tests.

FASHN API credits are separate from its consumer subscription. The published on-demand price for tryon-v1.6 is $0.075 per successful image, with a minimum $7.50 / 100-credit purchase. Verify the current offer in the provider dashboard before purchasing.

After adding the key and explicitly enabling live generation:

    pnpm exec supabase secrets set --env-file supabase/.env.server

Restart or refresh the app so its provider configuration query updates. No AI calls are made simply by adding a key; generation also requires the enable switch, signed-in user, two images, consent and an explicit Generate action.

## New deployment

    pnpm exec supabase login
    pnpm exec supabase link --project-ref YOUR_PROJECT
    pnpm exec supabase db push --linked
    pnpm exec supabase functions deploy tryon --use-api
    pnpm exec supabase config diff
    pnpm exec supabase config push
    node scripts/prepare-server-env.cjs
    node scripts/deploy-reconciliation.cjs

The reconciliation installer uses a generated worker secret and Supabase Vault. It never prints secret values. It is necessary for automatic refunds and completion when users close the app.

## Verified

- Eighteen local tests cover credit grants, idempotency, single submission claims, refunds, ownership, private access, durable rate limits, request/image validation and secure session storage.
- Seventeen hosted integration checks passed using temporary accounts and a supplied illustration fixture; no emails or AI requests were sent. The accounts, photos and job records were removed afterward.
- Hosted security advisor: no warnings after removing unnecessary API execution grants on the default automatic-RLS trigger.
- Reconciliation endpoint: HTTP 200. Scheduled job: active and successfully running.
- Strict app TypeScript and Deno backend type checks pass.
- iOS, Android and web production bundling succeeds. Native device testing is still required.
- Local browser selection, normalization, preview and removal were checked with a supplied illustration, not a personal photo.

## User acceptance still needed

1. Create a real app test account and confirm its email in the same browser/device.
2. Verify the live three-credit balance and persistent session.
3. Supply the approved provider key as a server secret.
4. Generate a real preview from consented adult photos, compare Before/After, save it and reopen it.
5. Verify native camera/gallery, safe areas, keyboard, secure storage and share sheet on iOS/Android.

The demo remains separate and does not apply selected photos to the supplied artwork.

## Data lifecycle

Photos stay local until Generate. Uploads are normalized to JPEG and bounded to 8 MB. Input and output files live in a private bucket. Genlook receives multipart bytes and supplies a hosted output which the server copies privately; FASHN uses base64 input/output. Private UI links expire after five minutes and are renewed when needed.

Job inputs/results remain private until the user deletes the history entry. Deletion removes both source photos and the result. Abandoned/unreferenced uploads are removed by reconciliation after one day. Failed jobs remain visible until deleted. A user's original gallery photo is never deleted.

Provider retention is governed by FASHN's terms: base64 processing copies are temporary, output access expires, and request metadata may remain in the provider account. Deleting in Outfit League does not delete provider request metadata.

Unsuccessful submission, provider failure, invalid output or a 15-minute timeout returns a reserved credit once. A completed generation consumes one credit even if the user subsequently deletes its photos.

## Known limits

- Only upper-body garments; no size/fit prediction.
- No in-flight cancellation at the provider. Leaving the progress screen keeps the job running.
- Requests per account: one active job, eight generation attempts per hour, twenty-four input-upload tickets per hour. Deleting history cannot reset these limits.
- History currently lists the latest fifty jobs.
- Shopping and public battles are still demo/deferred.

Sources: https://docs.fashn.ai/api-reference/tryon-v1-6 ; https://docs.fashn.ai/api-overview/data-retention-privacy ; https://help.fashn.ai/plans-and-pricing/api-pricing
