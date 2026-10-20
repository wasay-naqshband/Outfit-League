# Milestone 6 — Shop saved looks

Implemented: Supabase catalog browsing, source selection from Explore/private Closet/completed AI looks, metadata-based garment hints, category/search refinement, strict budget filtering, product detail disclosures, pagination, and comparisons within the same category/currency/sample status.

The interface preserves the existing yellow header, segmented tabs, white rounded product cards, stickers, bundled typography, and floating tab bar. Supplied character artwork is not treated as a product photograph. Ten sample product records use the five original flat garment illustrations and explicitly illustrative USD prices. There are no purchasable seed offers, stock claims, retailer links or affiliate commissions. The combined update is live at https://chutni.store as of October 20, 2026.

## Data and services

- Migration `202610190006_catalog.sql` is deployed. Published products and active retailers are readable; price/match/retailer writes and click logs are server-only. Database search is literal, combined with filters and ordered cursors.
- `src/lib/shopping.ts` provides the catalog adapter. `MetadataGarmentIdentifier` uses saved details, not image recognition. A completed AI look asks the user to refine its category; it does not call a model or upload a photo for shopping.
- Exact matches require a verified non-demo match with an evidence URL and verification date. All supplied matches are Similar. Replacing a saved sample with a personal photo removes its eligibility for the original exact-match source.
- The `shopping` Edge Function is deployed. It resolves an approved HTTPS destination from server catalog records, blocks demo products, checks exact retailer/affiliate host allowlists, and records idempotent product-only outbound events. It does not accept client-provided prices or destination URLs.
- Affiliate routing additionally requires approval on both the retailer and product. No affiliate program is currently activated. Live positive outbound acceptance must be run once a permitted feed is connected.
- Comparisons describe only the loaded catalog results; they do not claim the cheapest price across the internet. There is no currency conversion. The initial catalog and budget input use USD. Price formatting supports the currency's minor-unit precision.

## Validation

Six local catalog tests cover cursor boundaries, literal search, strict budget limits, currency/category/demo comparison isolation, ownership/write restrictions, verified exact matches, unpublished proof isolation, metadata honesty and external URL guards. Thirteen hosted catalog checks passed without accounts, emails, AI calls, click creation or purchases. See `qa/milestone-6-hosted.log` and the current combined test log.

Browser checks include the two Navy products, comparison expansion, strict exclusion at the exact budget boundary, invalid budget state, empty verified Exact state and expanded demo disclosures. The final combined release also receives source-selection/navigation and production checks. Evidence is in `qa/`.

Run `pnpm test`, `pnpm test:shopping:hosted`, `pnpm typecheck`, and `pnpm check:server`. `pnpm export:web` includes the font/icon asset flattening required by manual static hosting uploads.

## Decisions for the owner's return

1. Choose the launch market and currency.
2. Supply or approve a permitted retailer/catalog feed and its image/price refresh terms.
3. Choose whether to join affiliate programs; supply only their public catalog configuration and securely stored server credentials as required.
4. Decide whether automatic garment recognition is worth adding after testing its quality and cost. The current metadata adapter works without another API key.

No scraping, retailer service purchase, affiliate enrollment or new external AI service has been started.
