# Milestone 4 — Explore

Explore now reads the published Supabase catalog. It preserves the supplied gradients, illustrations, stickers, masonry cards, typography and floating navigation.

## Behavior

- Guest browsing, server-side literal substring search across names, brands, tags and clothing categories, combined with style filters. Search is debounced by 300 ms and limited to 100 characters.
- Rank-based cursor pagination, 12 outfits per page; loading, retry, empty and next-page retry states. The five-item seed has no extra page, so pagination is also tested with 30 temporary local fixtures and smaller hosted page sizes.
- Details use the requested catalog ID without silently substituting a different sample. Only published items can be read or saved.
- Authenticated Save creates a private inspiration snapshot. A unique owner/catalog index and atomic RPC prevent duplicate saves, including simultaneous requests. Re-saving preserves user edits. Deleting permits a fresh save later.
- The snapshot keeps its name, category, brand, tags, description, source attribution/URL and bundled image/garment keys independently of catalog edits or removal. Snapshot identifiers cannot be forged through client column writes.
- Closet displays bundled sample artwork when there is no personal photo. Details can hand off the separate flat garment illustration. Personal photo replacements take precedence; removing one restores the sample fallback.
- Explore and Closet handoffs prepare a local JPEG draft. They do not call an AI provider. The existing Try On photo, consent, authentication, credit and explicit Generate requirements apply.

## Initial content and image provenance

Five entries use supplied design artwork: Navy bomber, Cream layers, Rust jacket, Green varsity and Everyday layers. All are labeled as samples. No brand, retailer, price or social-post URL is fabricated.

`assets/garments` contains five original code-drawn flat garment JPEG illustrations. The character artwork is never sent as the garment by these new actions. These are demonstration inputs, not photographic-quality try-on validation. Users can replace them with their own clear garment photographs. `scripts/create-sample-garments.cjs` contains the original SVG drawing instructions; regenerating requires Sharp (or its module path in SHARP_MODULE). Runtime builds use the committed JPEG files and do not require Sharp.

## Deployment and access

Migration `202610190004_explore.sql` is deployed to the linked project. Catalog SELECT is public only for published rows; catalog writes are server-only. The search RPC is security-invoker, respects RLS, bounds page sizes to 1–40 and treats punctuation literally. The save RPC has a pinned search path, requires auth.uid(), and copies only a published catalog row into that owner's private library.

No new provider credentials, external shopping service, purchases, AI calls or public user submissions are required. Admin catalog editing remains outside this milestone.

## Verification

- 32 local tests pass, including full-catalog search beyond the first page, cursor boundaries, literal search, unpublished records, immutable snapshot identifiers and private idempotent saves.
- 15 hosted checks pass with disposable accounts: guest browsing, cursor pages, style/search, no-match results, blocked guest saves/catalog publishing, four concurrent saves producing one record, snapshots, privacy, forged-column rejection, missing items, persistence, unchanged credits, deletion and re-save. Test accounts and records are removed.
- TypeScript and web/iOS/Android bundle export checks pass. Physical native device verification is still outstanding.
- Browser acceptance completed at 390×844: combined search/style filters, no-match results, reset, detail, save, full reload, Closet listing, editing without a new upload, Closet-to-Try-On and direct Explore-to-Try-On. Generate remained disabled without a person photo/consent. The owner's balance stayed at two credits; no AI requests were made. One Navy bomber sample remains saved for owner review. Screenshots are under `qa/milestone-4`.

Shopping and battles remain labeled previews. Live photographic catalog content and a publishing/moderation workflow remain future work.
