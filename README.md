# Outfit League

Native Expo + React Native application matching the six supplied visual references. Milestones 1–5 cover the design, private try-ons and credits, personal Closet, persistent Explore browsing/saves, and anonymous/public outfit battles. Milestone 6 adds honest sample-catalog shopping, and Milestone 7 adds private credit activity and release foundations. The public web app is live at https://chutni.store. The same components run on web for review.

## Run

Requirements: Node.js 22.13+ (the native preview pins 24.19.0), pnpm. Dependencies are already installed in this workspace.

    pnpm install
    pnpm start

Use a compatible Expo Go version or an Expo development build for SDK 55. The project deliberately pins a stable SDK and its compatible native dependencies. Current store versions of Expo Go may require a newer SDK; use a matching development build rather than mixing package versions.

    pnpm android
    pnpm ios
    pnpm dev

iOS simulator builds require macOS. Android requires a device or emulator. The web development preview uses port 8081.

## Review the production preview

The exported web build is in dist. Start it with:

    pnpm preview

Then open http://localhost:8083. On this Windows workspace, Start-Outfit-League.ps1 also starts that preview using the available Node runtime. The server listens only on the local computer. It supports navigation and direct route refresh.

To rebuild:

    pnpm export:web
    pnpm preview

## Supabase authentication foundation

Copy .env.example to .env and fill in your Supabase project URL and public anonymous/publishable client key. Never put a service-role key in this app. Restart Expo after changing environment values.

Email authentication, email confirmation and local redirect destinations are configured on the connected project. Sign-in, sign-up, reset-email requests, sign-out, session restoration and native secure session storage are implemented. A checkout without connection values still supports guest demo browsing and explains why auth submission is unavailable.

Email-confirmation and password-recovery routes, account profiles, private data tables and ownership policies are implemented. The supplied Supabase project has been connected and deployed. The production browser callback and battle return route are verified; native device confirmation/recovery tests remain. See MILESTONE_2_SETUP.md.

Apple authentication is omitted until configured. No account is needed to review the demo.

## Structure

- app: Expo Router stacks and four-tab navigation.
- src/theme.ts: palette, gradients, fonts, radii and platform shadows.
- src/components: reusable native headers, buttons, cards, stickers, tabs, segments, upload previews, avatars and product rows.
- src/data.ts: explicitly sample outfits and illustrative catalog entries.
- src/lib: optional Supabase client, session lifecycle and local demo state.
- assets/illustrations: exported original handoff artwork.
- design-reference: untouched supplied mockups and specification.
- qa: visual comparison evidence and build log.

The mockups' browser runtime is not included in application code. Fonts and illustrations are bundled locally.

## What to try

Explore → search/filter → open an outfit → Save to your inspiration → open in Closet → Try this on → add your photo and consent → Generate only when ready.

Use the four floating tabs. Explore loads its labeled sample collection from Supabase, with server search, style filters and pagination. Closet contains your private Saved inspiration, My Closet and AI Looks. Add a link or image, edit its details, and choose a saved garment for Try On. Battles lets you preview and publish two selected looks, choose anonymous/public voting, and manage results.

Explore saves persist in your private Supabase inspiration collection and prevent duplicates. Supplied character illustrations and separate original flat garment illustrations are labeled samples. Closet → Shop selects a saved source, then supports category/search, strict budget limits and loaded-result price comparisons. Prices are illustrative; no real offers are connected. Exact requires verified non-demo evidence. Battles support private previews, explicit publishing, anonymous/public voting, reports and owner management. Copy/Share links point to the live HTTPS app, with selectable URL fallback for clipboard-restricted browsers. Saving, shopping and battles use no AI credits. Genlook is connected for user-triggered generation. Try On requires sign-in, two images, consent and an explicit Generate action. Credits → View credit activity shows the private server ledger. Purchases and external analytics remain off. See MILESTONE_4_SETUP.md through MILESTONE_7_SETUP.md.

## Checks

    pnpm typecheck
    pnpm format:check
    pnpm exec expo install --check
    pnpm exec expo export --platform all
    pnpm test
    pnpm check:server

See TESTING.md, design-qa.md and IMPLEMENTATION_STATUS.md for verified behavior and remaining limits.

## October 20 account and catalog update

Milestone 8 adds owner profile/display-name controls, password-confirmed account deletion with durable delayed file cleanup, support at the supplied contact address, and server-authorized battle-report moderation. Actual phone acceptance and final policy review remain outstanding. Milestone 9 adds a separate USA/USD catalog mode, approved-feed snapshot importer, permitted remote images, expiring offers and guarded retailer links. No genuine retailer feed has been connected; sample data remains visibly separate and unpurchasable. See MILESTONE_8_SETUP.md and MILESTONE_9_SETUP.md.
