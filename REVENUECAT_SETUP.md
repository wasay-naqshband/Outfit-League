# RevenueCat setup for Outfit League

The app grants three welcome credits. The one-time try-on pack is fifteen credits
for $4.99. Planned Pro pricing is $9.99/month or
$49.99/year. Both Pro plans refresh to 40 try-ons and five included 360° views
each month. Unused monthly allowances expire at refresh; free and purchased
credits do not. The App Store supplies localized prices. Supabase remains the
credit ledger; the app never adds credits from a client purchase result.

## Account setup

1. In App Store Connect, add a **Consumable** in-app purchase with product ID
   `outfit_tryons_15` at $4.99. Add auto-renewable subscriptions
   `outfit_pro_monthly` at $9.99 per month (three-day introductory offer
   pending), and `outfit_pro_yearly` at $49.99 per year. Localized display prices come
   from Apple.
2. RevenueCat is configured with the iOS app (`com.outfitleague.app`), a valid
   App Store Connect In-App Purchase key, the `pro` entitlement, and the
   `default` offering. The offering contains annual, monthly, and one-time
   15-credit packages. The two subscriptions are attached to `pro`; the
   consumable pack is not. The app highlights the yearly plan.
3. The RevenueCat **public iOS SDK key** is in ignored local `.env` as
   `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and in Codemagic's app-level
   `outfit_league` variable group as `REVENUECAT_IOS_SDK_KEY`. The iOS workflow
   imports that group and maps the value into the Expo build. Never use a
   RevenueCat secret API key in the app.
4. The authenticated RevenueCat webhook is configured for both production and
   sandbox events at
   `https://xxrylsmiaehgnljyzguh.supabase.co/functions/v1/revenuecat-webhook`.
   Its authorization value is kept in ignored local file
   `supabase/.env.revenuecat`; do not commit or disclose it. A RevenueCat test
   event received HTTP 200 from the function.
5. The try-on pack and subscription webhook functions use verified RevenueCat
   events and grant allowances through Supabase. StoreKit requires a native
   iPhone build for purchases.

The webhook accepts `NON_RENEWING_PURCHASE` for the pack and the subscription
purchase, renewal, cancellation, and expiration events. It ties transactions to
the signed-in Supabase user ID and deduplicates event IDs and store transaction
IDs. Subscription credits and 360° allowances are server-controlled. Restoring
a purchase refreshes the server balance; it never grants credits directly from
the device.

## Remaining store review work

The three Apple products are created with the agreed USD prices and customer
labels, but are still Prepare for Submission. They must be submitted with a new
app version and approved before customers can buy them. The monthly product's
three-day introductory offer still needs to be added in App Store Connect.
