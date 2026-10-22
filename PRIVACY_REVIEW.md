# Outfit League test-release privacy notice — owner review draft

Prepared October 20, 2026. This is a factual draft based on the implemented product. It has not been published as a final legal policy. The owner still needs to confirm the responsible operator's details, applicable audience/territories, and any required legal disclosures before wider release.

## Contact

Contact Outfit League at wasayiqbal2@gmail.com for support, account questions or privacy requests. For an account request, write from your account email where possible. Do not email passwords, verification codes, API keys or private photos.

## Account and private collection

We use your account email and authentication information to sign you in. Authentication is handled by Supabase. Your optional display name, profile photo, saved try-on photo, Closet items, saved outfit inspiration, garment descriptions, notes, uploaded photos, generated previews and credit activity are stored to provide the features you choose. They are associated with your account and are not part of a public profile.

Your session is persisted on your device so you can remain signed in. The native app uses the operating system's Keychain/Keystore through SecureStore. The web app uses browser storage. Private image access uses expiring links; do not share those links. Authorized server operations and service providers process data needed to run the app.

## AI previews

Only an explicit Generate action, with your chosen person/garment images and try-on consent, sends those images to the configured AI provider. The current provider is Genlook. We request one-day product/output storage using the provider's API options and copy completed results into our private storage. This request is not a guarantee of deletion from every provider system or backup. Provider handling is subject to its own terms and retention practices.

A separate explicit "Make 360° view" action on a completed look sends that look's AI result image to Google's Gemini API (paid tier) to create a short turntable video, which is stored privately with the look and deleted with it. Google's paid-tier API terms govern its handling of those requests. The AI Stylist uses the same Gemini API only on an explicit tap: "Rate my fit" sends that look's result image (the rating is stored with the look), "Your colours" sends the saved try-on photo (the result is stored on the profile), and "What should I wear?" sends the occasion text plus closet item names, categories, colours, brands and tags (no photos). "Try on from a store link" makes the server fetch the public product page the user pasted or shared, and its product image, which is returned to the device and handled like a chosen photo.

Browsing, saving a look or searching the shopping catalog does not automatically submit photos to AI. Only upload images you have permission to use. AI results are generated visuals and may be inaccurate; they are not a measurement or a guarantee of fit.

## Battles and votes

Publishing a battle requires a separate confirmation. It makes the battle title and the two selected image snapshots available to people with the voting link. Public links may be forwarded. Original private inputs and your full Closet are not published by that action.

Anonymous voting stores a protected account/browser voting identifier and the selected side, without a voter display name. Public voting requires sign-in, a display name and explicit consent to show the name and choice to people with the link. Names are self-chosen rather than verified identities. Existing public votes keep the name approved when voting. Clearing browser data or using another device can bypass the limited guest duplicate-vote protection.

Reports and moderation records are used to review abuse. App rate limiting uses protected identifiers derived from request/account information. Reports are not shown as public comments. Only server-appointed administrators can review reports or hide battles.

## Shopping and service providers

Current shopping samples are labeled illustrations with illustrative prices and no purchase links. A first retailer partnership is pending; it is not yet a live feed. Future approved retailer links may record the product and whether an affiliate destination was used without attaching your account identity or private photos to that click record. Retailer sites handle their own checkout and privacy practices. Any provider/retailer changes require this notice to be reviewed again.

Supabase provides authentication, data/storage and server functions. Netlify hosts the web application. Genlook processes explicitly requested AI previews, and Google Gemini processes explicitly requested 360° views. Infrastructure providers may process technical request information needed to deliver their services. No external analytics sink, payment provider or credit-purchase service is currently connected in the app.

## Retention and removal

Saved collection items and completed looks remain associated with your account until you remove them or request account deletion. Abandoned uploads are eligible for automatic cleanup. Deleting an item or try-on removes access to the corresponding private record and schedules or performs file removal. Existing downloaded copies cannot be recalled.

Account deletion is available through Settings → Profile & account controls. It requires typed confirmation and password re-entry. An active generation must finish first. Once accepted, account data access is blocked, owned battle links are unpublished, and account-linked battle votes are removed. Cleanup of private files, snapshots and the authentication account retries automatically after about two hours ten minutes, allowing issued upload links to expire. A service failure can delay cleanup while the durable request remains queued. Existing image links may still work for up to five minutes. Limited moderation audit records can remain without the deleted moderator's account identifier.

Unpublishing or deletion cannot remove screenshots, copies other people saved, or provider-held data outside our deletion workflow. Contact support if you need help with a privacy request. The owner must confirm provider contractual retention, backup/log handling and the final policy's required rights/request wording before approval.
