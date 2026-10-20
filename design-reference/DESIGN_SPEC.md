# Outfit League — Visual Design Spec (handoff for Codex / Claude Code)

Outfit League is an AI fashion app: **Try On** (AI virtual fitting), **Explore** (inspiration feed), **Battles** (friends vote "Which fit wins?"), **Closet** (Saved / My Closet / Shop Saved Look). Tagline: *Discover it. Save it. Try it. Shop it. Share it.*

## How to use this package
- `screens/*.dc.html` are **visual reference mockups**, not production code. Serve the folder (`cd screens && python3 -m http.server`) and open each file. Replicate the values below in your own stack (React Native / SwiftUI / Flutter / web). Do not copy the runtime scripts.
- All screens are **390 x 844** (iPhone 14 logical size). Use safe areas on device; mockups draw no status bar.
- Screens: `Welcome`, `Main` (= Explore), `TryOn` (the "Your look" result), `Battles`, `Closet` (Saved tab only), `ShopLook`.
- Treat this file as the source of truth where a mockup and this text disagree, except exact pixel values, which live in each mockup's inline styles.
- Placeholders in mockups (`$00`, `[Retailer]`, `[N]`) are real data in the app. Figures are flat illustrated avatars standing in for user/outfit photos.

## Design tokens
**Color**
| Token | Value | Use |
|---|---|---|
| yellow | `#FFE93B` (gradient `#FFF48A` > `#FFE93B` 55% > `#FFDD1F`) | header ground, active tab, primary accent |
| ink | `#14121F` | text, dark buttons, tab bar, selected chips |
| cream | `#FFFBEA` | screen/sheet background |
| cream-chip | `#FFF7C4` | unselected chips on yellow |
| white | `#FFFFFF` | cards, search, card borders |
| pink | `#FF9BD2` | stickers, VS badge, "Best match" |
| text-2 / text-3 / placeholder | `#4B475A` / `#6B6675` / `#8A8596` | secondary, caption, input placeholder |
| tabbar-icon-off | `#D8D3E4` | inactive tab icons |
| success | `#4ADE80` | Live dot, vote check |
Outfit card gradients (top > bottom): lavender `#DCD5FF>#B9ACFF`, coral `#FFC2B6>#FF7A66`, mint `#CFF5E4>#8EDDBC`, sun `#FFF1A8>#FFD43B`, pink `#FFE0F0>#FF9BD2`. Rotate through these for outfit tiles.

**Type** — Headings: *Bricolage Grotesque* 800 (negative tracking). Body/UI: *Figtree* 400/500/700.
Welcome/Battles title 34/1.02, -1.2px. Explore title 26, -0.6. "Your look" 28, -0.8. Card name 15 (Bricolage 800). Sticker 14-24 (Bricolage 800). Body 16/1.4. Buttons and chips 17 (700 / chips 500, selected 700). Tab label 16/700. Caption 12-13.

**Radius** — sheet/header bottom 36; outfit card 28 (hero card 32); button 18; search 20; chip 22 (full pill); sticker 14; tab bar 32; active tab pill 24; logo tile 11; avatar full.
**Border** — outfit cards: 4px white (selected battle card: 4px ink). Stickers: 3px white.
**Shadow** — card `0 10 24 rgba(20,18,31,.16)`; sticker `0 2 0 rgba(20,18,31,.15), 0 8 16 rgba(20,18,31,.2)`; tab bar `0 10 30 rgba(20,18,31,.3)`; header `0 8 24 rgba(20,18,31,.10)`; Welcome sheet `0 -12 40 rgba(20,18,31,.18)`.
**Spacing** — screen side padding 20; gaps 10-14; touch targets >= 44 (buttons 56, chips 44, tab items 48).
**Personality** — playful, sticker-like: tilted pills (+/-5-8 deg), thick white borders, big rounded corners, yellow + ink contrast. Never emoji; icons are 2px-stroke rounded line icons (compass, sparkle, bolt, hanger, search, back arrow, heart, share, bag, check).

## Shared components
- **App header (Explore, Closet)**: yellow gradient block, height 214, bottom radius 36. Row at top 28: logo tile 36 (ink, yellow "OL"), screen title, right pill "sparkle N try-ons" (ink, 44 high). Search field at top 86 (white, 52 high, radius 20, search icon + placeholder). Chip row at top 152 (44 high, horizontally scrollable, first chip selected = ink/white).
- **Flat header (Your look, Shop the look, Battles)**: yellow block 120-129 high, no radius; content sits on cream below. Back button = 44 white circle. Segmented control (white, 52 high, radius 20) straddles the yellow/cream edge at top 86.
- **Bottom tab bar**: floating ink pill, 16 from sides and bottom, 64 high, radius 32. Order: Explore (compass), Try On (sparkle), Battles (bolt), Closet (hanger). Active tab = yellow pill (48 high) with icon + label; inactive = icon only.
- **Outfit card**: gradient tile + 4px white border + figure/photo bottom-aligned. Optional overlays: top-left source/status pill, corner sticker, bottom label bar.
- **Label bar** (on card): white 94%, radius 20, 56 high, 8 inset; name (Bricolage 15) + category (13, text-3); right 40 ink circle with yellow sparkle = "Try this on".
- **Sticker**: rotated pill, 3px white border, Bricolage 800. Pink = trending/praise, white = new, yellow = winning vote.
- **Dark promo card**: ink, 4px white border, radius 28, title (Bricolage 22 white), body (14, `#C9C5D6`), yellow 44 button.
- **Buttons**: primary = ink fill, white 17/700, 56 high, radius 18 (optional yellow leading icon). Secondary = white fill, 1.5px ink border.
- **Avatars**: 44 circles, 2px cream ring, overlapped -10px, initial in Bricolage.

## Screens
1. **Welcome** — Yellow radial gradient. Logo top-left. Three tilted outfit cards (-8, +7, -2 deg) with stickers "Try it on" (pink) and "Which fit wins?" (white). Cream bottom sheet (height 380, radius 36 top): headline "Find the fit. Try it on. Let the squad vote.", subcopy, buttons Continue with Apple (primary) / Continue with email (secondary), legal caption. Both go to Explore.
2. **Explore** — App header (title "Explore", chips Trending/Streetwear/Minimal/Y2K, scrolls). Masonry, two columns (17 and 201 from left, 172 wide, gap 14). Left: navy bomber card 258 (Trending sticker + label bar), rust card 228. Right: coral card 201 ("New" sticker), "Battle of the day" dark card 170 ("Vote now" -> Battles), mint card. Sparkle on a label bar = Try On with that look. Feed scrolls under the tab bar.
3. **Try On / Your look** — Flat header: back, "Your look", pill "2 try-ons left". Segmented Before | After (After selected). Hero card 359 high (lavender, radius 32) with "AI preview" white pill top-left and pink sticker "Looks good on you" bottom-right. Three action tiles (white, 64 high): Save, Battle it, Share. Primary "Shop this look" (yellow bag icon) -> Shop the look. *Not drawn:* the pre-generation picker (choose your photo + a look from Saved/Explore/gallery, then "Generate"), loading and out-of-credits states.
4. **Battles** — Flat header: "Which fit wins?" (34), subtitle "Tap a fit to vote", ink "Live" pill with green dot. Two cards 300 high side by side (Fit A selected: ink border, yellow "62%" sticker, ink "Your vote" button with green check; Fit B: white border, white "38%" sticker, white "Vote B" button). Pink VS badge (52) overlaps the center. Below: overlapped avatars + "128 votes so far". Row: Share battle (primary, share icon) + Copy link (secondary). Battle links open a mobile web vote page with no install (not designed yet; reuse this layout).
5. **Closet** — App header (chips Saved / My Closet / Shop; search "Search your saved looks"). Saved tab: same masonry as Explore, each card has a source pill (TikTok, Instagram, Pinterest, Website, Screenshot) and a dark card "Shop saved look" -> Shop the look. *Not drawn:* My Closet tab (owned items + saved try-on results; use Explore masonry with "Add item" tile) and Shop tab.
6. **Shop the look** — Flat header: back, "Shop the look", pill "3 pieces". Segmented Exact | Similar | Budget. Rows (white, 96 high, radius 24): thumbnail 72, item name, retailer, price; pink "Best match" sticker on the top match. Primary "Compare prices" button. Tapping a row opens the retailer site (affiliate link).

## Flow
Welcome > Explore. Tabs: Explore, Try On, Battles, Closet (always available). Explore card sparkle > Try On with that look > Your look > Save / Battle it / Share / Shop this look. Battle of the day > Battles. Closet Saved > Shop saved look > Shop the look > external retailer.

## Product rules to respect
- Try On is style visualization, not size prediction. Show "AI preview" label on generated images.
- Free tier: limited complimentary try-ons (the "N try-ons" pill), purchasable credits, optional "Outfit League Pro" subscription. Upsell states are not designed yet.
- Shop results are Exact match / Similar / Budget alternatives, from supported retailers; purchases go to external sites.
- Saved accepts links/screenshots shared from TikTok, Instagram, Pinterest and web (share-sheet extension), keeping the original source link.

## Not yet designed
My Closet tab, Closet Shop tab, Try On picker and loading states, Pro / credits paywall, battle creation flow, web vote page, empty/error states, onboarding after sign-in, dark mode (none planned).
