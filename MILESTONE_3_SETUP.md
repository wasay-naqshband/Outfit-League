# Milestone 3 — Closet and external saving

The in-app implementation is deployed to the connected Supabase project and available at http://localhost:8083/closet.

## What works

- Saved inspiration: source links, gallery images and screenshots, name, category, color, brand, tags and notes.
- My Closet: personal clothing photos and metadata, searchable across loaded items. Older items load in pages of 40.
- AI Looks: completed generated looks, with existing private comparison, saved state, sharing and deletion. Full history includes pending and failed jobs.
- Add, edit, replace/remove photos and explicitly confirm deletion. Saving does not consume AI credits.
- Choose an item with a photo, tap Try this on, then choose a person photo and consent on Try On. Selecting a saved garment does not generate or charge.
- Source-only imports remain useful when social sites do not expose their media. We do not scrape platforms or automatically fetch links. Attach a screenshot when needed.

## Storage and deletion

Migration 202610190003_library.sql adds library_items, a private library-private bucket, ownership policies and a durable library_cleanup outbox. Metadata has bounded lengths and photo paths are restricted to the owning item. Authenticated clients cannot change ownership or execute cleanup functions.

Images are normalized locally to JPEG, bounded to 8 MB, and uploaded only on Save. Display links expire after five minutes and renew every four minutes. Replaced/deleted photo paths enter a server-only cleanup queue, processed by the existing one-minute worker. Uploads left unreferenced by an interrupted operation are cleaned after one day.

Deleting metadata blocks issuing new signed URLs immediately. Previously downloaded or cached copies cannot be revoked; existing signed links may remain valid until the object is removed or the link expires. Provider copies of an already generated try-on follow the provider retention policy. Deleting a Closet item does not delete independently generated looks.

## Native receiving shares

Expo Sharing's plugin registers Android ACTION_SEND for text/plain and image/*, plus an iOS share extension for a single image, URL or text. The native-intent route opens the import form. Raw shared text/URLs are kept without resolving external pages; local shared images are normalized on the device. Nothing uploads until the user signs in and presses Save. The first image and link are accepted; extra images can be saved separately.

Native configuration introspection passes, including Android intent registration and the iOS App Group. Physical share-sheet acceptance still requires a custom native build, appropriate native toolchains/signing and real devices. Expo Go and the browser cannot verify these integrations. Expo SDK 55 marks receiving shares experimental; its iOS implementation opens the main app, an approach Apple does not officially support. This must be evaluated on iOS before release. No App Store readiness is claimed.

Reference: https://docs.expo.dev/versions/v55.0.0/sdk/sharing/

## Verification

    pnpm typecheck
    pnpm format:check
    pnpm test
    pnpm check:server
    pnpm test:images
    pnpm test:library:hosted
    pnpm exec expo export --platform all

28 local tests cover the existing credit/job safeguards plus library RLS, owner-only photos, cleanup queuing, import URL safety and native routing. Two Deno image conversion tests cover provider result conversion. Sixteen hosted library checks exercise real private storage and temporary accounts, with no AI calls or email. Their records/accounts are removed afterward. The older test:hosted command intentionally requires AI to be disabled; do not disable live generation merely to rerun it.

Browser verification at 390 × 844: image-and-link import, persistence after refresh, metadata editing without photo loss, tag search, saved-photo handoff to Try On, and disabled Generate without a person photo/consent. QA uses supplied sample artwork, never claims it is a live try-on, and does not generate.

Screenshots are in qa/milestone-3. The local preview runs on this computer; a phone cannot open its localhost URL.
