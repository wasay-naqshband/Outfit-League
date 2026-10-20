# Milestone 9 — US retailer catalog integration

Market chosen: USA / USD (owner allowed USA or UK). Current status: implementation and import path ready; no retailer feed or permission has been supplied, so there are no live products. This milestone is not complete until a permitted feed is connected and the positive retailer handoff is verified.

## Implemented

- Separate sample and USA retailer modes preserve the existing Shop layout. Samples cannot become retailer offers.
- Non-demo products use permitted remote image URLs, feed-supplied metadata and USD prices, explicit stock state and a full last-checked timestamp. Final tax, delivery, price and availability belong to the retailer.
- Expiry is required and cannot exceed 24 hours from the supplied price timestamp. Expired, future-dated and reported-out-of-stock offers are hidden by RLS, including direct product queries, and rejected again at outbound click time. Live results refresh every 30 seconds.
- Category/color/brand searching continues to use saved metadata, without image uploads or AI recognition. Exact requires separately verified identity evidence; importing products never creates exact matches.
- Approved canonical and affiliate hosts remain mandatory. Feed approval notes and access locations are server-only columns. No feed or product can grant its own retailer approval.
- A complete retailer snapshot import is transactional, rejects duplicate IDs/invalid URLs/currency/timestamps, and unpublishes offers omitted from the new snapshot. Invalid input rolls back everything.

## Feed import

An operator must first approve an active, non-demo catalog_retailers row with country US, canonical domain, allowed image_hosts, feed_source and permission_evidence. Store a descriptive source and permission reference, not an API key or contract contents. Affiliate approval is separate and optional. Retailer/API credentials remain private server configuration; never place them in product/image URLs.

The import command accepts a UTF-8 JSON file, at most 5 MB and 1,000 products:

    node scripts/import-catalog.cjs APPROVED_FEED.json
    node scripts/import-catalog.cjs APPROVED_FEED.json --apply

The first command validates locally without a database write. Apply requires an authorized Supabase operator CLI and server-approved retailer. It publishes one complete snapshot, including unpublishing missing offers; an empty array deliberately unpublishes all that retailer's offers. There is no public/client import endpoint.

Envelope fields: retailer_id and products. Product fields: external_id, name, category, color, brand, tags, price_minor (integer USD cents), currency (USD), product_url, image_url, availability (unknown/in_stock/out_of_stock), price_checked_at and expires_at (ISO timestamps). Optional metadata defaults to empty, availability defaults to unknown. URLs must match the operator-approved exact product/image hosts. IDs are namespaced by retailer. Input must reflect a real permitted feed; illustrative fixture data must never be applied to production.

No feed credentials, automated fetch schedule or network scraper has been created speculatively. The chosen provider's authentication, schema mapping, refresh cadence and rights must be confirmed before implementing its actual fetch job. Expiry makes failures disappear instead of leaving stale offers visible.

## Access needed

Choose the first retailer or product-feed network and obtain permission for product data/images and linking. Possible routes researched from primary sources:

- Owner-selected first retailer: Urban Outfitters. Its official affiliate page explicitly offers a product feed, https://www.urbanoutfitters.com/help/affiliate . Its application link leads to Rakuten Advertising publisher registration. That page is open for the owner; no personal information or application was submitted. Account registration, retailer approval, actual feed access and any terms/costs remain for the owner to review. Choosing a retailer does not itself establish permission to publish its products.

- Awin's publisher feed guide documents names, prices, images and deeplinks, with access through publisher/advertiser arrangements: https://help.awin.com/developers/docs/product-feed-publisher-guide-intro and https://www.awin.com/gb/faqs . Enrollment/advertiser approval and any account cost must be checked before committing.
- eBay Browse supports marketplace search, but official getting-started documentation says production business-use approval is required: https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application . It is a marketplace alternative, not a promise of a specific fashion retailer's feed.

No account was opened, affiliate terms accepted, images scraped or money spent. The owner must complete any provider registration/approval personally. Do not imply US delivery for a product unless its feed actually supports that destination.

## Verification and limits

Actual-migration tests verify unapproved import refusal, approved fixture import in an isolated database, transaction rollback, hidden expired/out-of-stock offers, full-snapshot removals, client import denial and protected approval notes. Thirteen hosted shopping checks still pass with only clearly labeled demo products and no outbound click records created. The first genuine product/image URL, retailer availability, refresh failure and positive outbound handoff still require acceptance once a feed is available. No live retailer fixture was fabricated in the production database.

Rakuten publisher dashboard verified on October 20 after refresh; registration and email verification succeeded. Urban Outfitters (US), MID 43176, is discoverable in this publisher account and its Features tab explicitly shows Product Catalog and Deep Links enabled. Partnership status remains Not partnered. The program's additional terms, last updated March 23, 2026, require case-by-case permission for downloadable software and prohibit modification of retailer content without written approval. These constraints are relevant to the native app and any AI transformation of retailer images. No application, legal agreement, advertiser contact or feed access request has been submitted by the agent. Full terms are open in the browser for owner review. Production still has no real retailer data.

October 20 update: after the owner explicitly authorized accepting Urban Outfitters US MID 43176 terms dated March 23, 2026 and sending the application, the agent accepted and submitted it through Rakuten. Verified authoritative status: Pending (applied). Evidence: qa/urban-application-submitted.png. Approval has not been granted; native app permission, content-modification permission and feed access remain outstanding. No separate advertiser message was sent.
