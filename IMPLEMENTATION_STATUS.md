# Implementation status

Milestones 1–5 are implemented; the public web app is live at https://chutni.store. Milestone 6's sample shopping flow and Milestone 7's credit/release foundation are deployed in the October 20 update. Real retailer feeds, payments, final launch policy/deletion and physical-device acceptance remain. Genlook is connected for explicit user generation; the owner's existing successful try-on remains private.

## Working

- Expo SDK 55, React Native, strict TypeScript, four floating tabs and the supplied six-screen visual language.
- Exact shared palette, bundled Bricolage/Figtree fonts, gradients, rounded cards, stickers and supplied illustrations.
- Email sign-in, confirmation/recovery routes and protected sessions. Native auth and recovery still need device acceptance.
- Private person/garment uploads, authenticated jobs, idempotent credit reservations/refunds and scheduled reconciliation.
- Genlook integration with server-only key, direct photo submission, short retention requests, AI label and private result copying. FASHN adapter remains available.
- Before/After results, private history, saved looks, deletion and file sharing. Purchases remain disabled.
- Persistent private Saved inspiration and My Closet: photos, screenshots, source URLs, categories, colors, brands, notes and tags.
- Add/edit/delete items, replace/remove photos, search loaded items and load older pages.
- Saved garment selection into Try On; saving/importing items consumes no AI credits.
- AI Looks collection brings completed jobs into Closet and links to full history.
- Durable cleanup for replaced/deleted photos and abandoned uploads.
- Native share reception configured for text/URLs/images, with local import review before upload. Native configuration introspection passes; device testing remains required.

## Verification

- Current combined suite: 40 Node tests pass, including library ownership/storage policies, durable cleanup, import safety, native routing, catalog matching, credit accounting and disabled analytics/purchases.
- Two Deno result-image conversion tests pass.
- Sixteen hosted library checks pass using disposable accounts and no AI requests/emails. Temporary test records are removed.
- Earlier Milestone 2 hosted checks passed while generation was disabled. Genlook is now enabled for explicit user Generate actions.
- Web, iOS and Android bundle exports pass. Browser import/edit/persistence/search/saved-item-to-Try-On flow verified at phone dimensions.
- Worker endpoint responds successfully. Database advisor reports no library/RLS warnings; Supabase Auth reports its default leaked-password protection setting is disabled.

## Demo and later milestones

- Milestone 4: Supabase Explore feed, database search/style filters, cursor pagination, details, private duplicate-safe inspiration snapshots and garment-to-Try-On handoff are implemented. Five catalog entries are clearly labeled supplied samples with original flat garment illustrations. See MILESTONE_4_SETUP.md.
- Shopping products/prices remain explicitly demo data.
- Milestone 5 is live at https://chutni.store: battle creation, private snapshots, publication, anonymous/public votes, results, reports and close/unpublish. Netlify hosts the static app; Hostinger root/www records point there, with email records preserved. HTTPS and production auth callback are verified. Clipboard-restricted browsers get a selectable link fallback. See MILESTONE_5_SETUP.md.
- Milestone 6: persistent sample catalog, metadata-only garment hints, search/category/budget filtering, verified-exact gating, loaded-product comparisons and guarded retailer/affiliate routing foundation. No real retailer feed or affiliate program is active. See MILESTONE_6_SETUP.md.
- Milestone 7 foundation: owner-only credit activity, inactive purchase preview/adapter, analytics allowlist with telemetry disabled, privacy information and credit-ledger regression checks. Store payments remain deferred. Account controls and support were subsequently added in Milestone 8. See MILESTONE_7_SETUP.md.
- Milestone 8: persistent profile and vote-name prefill with unchecked visibility consent; typed/password-confirmed deletion; old-token RLS denial; private files/snapshots/Auth cleanup after upload-token expiry; protected moderator membership, report review, audited hiding; support contact. 44 Node tests and 25 hosted disposable-account checks pass. Native preview builds and final physical-device/policy acceptance are tracked in MILESTONE_8_SETUP.md.
- Milestone 9: USA/USD live-catalog mode, server-approved complete-snapshot import, permitted image support, 24-hour maximum price expiry, stale/out-of-stock hiding and outbound revalidation. Actual retailer/feed approval and positive live-offer acceptance remain required. No fabricated live products were published. See MILESTONE_9_SETUP.md.
- Live retailers, affiliate enrollment, payments, Apple authentication and external analytics remain deferred.

## Practical limits

- Native behavior is not yet verified on physical iOS/Android devices. Check camera/gallery, keyboards, safe areas, auth restoration, sharing and incoming intents.
- Receiving shares requires a custom native build. Expo SDK 55's iOS share extension approach is experimental and requires release evaluation.
- Link imports save source URLs without extracting restricted social media. A screenshot can be attached.
- Search covers loaded Closet pages; load older items to include them. Generated history currently shows the most recent 50 jobs.
- Photos already downloaded/cached cannot be revoked. New signed access is blocked on deletion; bytes are queued for the worker to remove.
- AI preview quality and physical fit are not guaranteed. Provider output and native device behavior still need broader acceptance testing.

See MILESTONE_2_SETUP.md, MILESTONE_3_SETUP.md and TESTING.md for details.
