# Outfit League visual QA

Scope: Milestone 1 native components, reviewed through the React Native web renderer.

## Comparison targets and evidence

Source visual truth: design-reference/DESIGN_SPEC.md and design-reference/screens/{Welcome,Main,Battles,Closet,TryOn,ShopLook}.dc.html.

Implementation: local production preview at http://localhost:8083.

The qa directory contains welcome, explore, closet, battles, result and shop files with -reference.png, -app.png and -comparison.png suffixes. Each comparison puts the original on the left and implementation on the right in the same image.

Viewport: 390 × 844 CSS pixels; source and application captures: 390 × 844 pixels, density 1. Comparison images: 780 × 844. No device bezel or simulated status bar is included. Small-screen checks use 320 × 568.

## Findings and fixes

- [P2, fixed] Welcome heading wrapped differently. Explicit responsive line breaks now match the reference's three-line composition. Rechecked against welcome-comparison.png.
- [P2, fixed] A nested clickable card/action generated invalid button nesting in the web renderer. Card and sparkle now have independent sibling targets. Production interaction checks and console review show no current rendering errors.
- [P2, fixed] On 320-point screens, Battles and result headings wrapped into adjacent regions. Compact heading and credit-pill variants now keep the title row usable. See battles-small.png and result-small.png.
- [P2, fixed] Small feed labels spilled outside their cards. Compact text size, reduced padding and omission of the secondary category at small widths preserve the action target and contain the title. See explore-small.png.
- [P2, fixed] Supporting feed cards were too tall in Closet. Lower cards now use the reference's 200-point height; Explore keeps the reference's initial four sample outfits.
- [P2, fixed] An unnecessary result back button appeared behind the floating bar. Removed it; the persistent tab and stack back action already provide navigation.

## Required fidelity surfaces

- Fonts/typography: Bricolage Grotesque 800 and Figtree 400/500/700 are bundled and loaded. Heading hierarchy, tight tracking and small labels are recognizable. Static font optical metrics produce minor differences from the HTML's variable web fonts.
- Spacing/layout: header heights, 52-point search and segment controls, rounded masonry tiles, 359-point hero, 96-point product rows and 64-point floating bar match the source composition. Small-screen scroll padding preserves reachable actions.
- Colors/tokens: yellow, ink, cream, pink and all five outfit gradients use the supplied hex values. Native linear yellow gradients are an accepted platform approximation of the source radial gradient.
- Images: original source illustration assets are raster-exported at 600 × 700 with transparency. Figures remain bottom-aligned. Hero crop and outfit subjects match. No replacement photos or generated content were introduced.
- Copy/content: demo labels replace fake balances, vote percentages, live activity, retailer placeholders and unsupported exact-match claims. Guest entry replaces unconfigured Apple authentication. These are intentional functional requirements from the master prompt.

All six full-view comparisons were opened and reviewed. The label bars, source badges, product rows, segmented controls and navigation icons were readable within those paired images, so separate crops were unnecessary.

## Accepted differences / P3 polish

- Feather/Material Community line icons closely match, but are not the source's hand-authored icon paths.
- Platform shadows differ subtly from CSS shadows.
- Welcome stickers and illustration bounds vary by a few points.
- Label text wraps slightly differently because touch targets are at least 44 points.
- Shop's comparison button has a small vertical-spacing difference.

## Implementation checklist

- Six reference layouts recreated and compared.
- Four tabs and core demo interactions verified.
- Main hierarchy, tokens, images, typography and content reviewed.
- P2 findings corrected and relevant screens recaptured.
- Native device visual verification remains a separate test gap, not claimed by this browser review.

final result: passed

## Explore product-detail handoff — November 20, 2026

Source visual truth is the supplied outfit-league-product-detail-handoff.zip, extracted at /tmp/outfit-product-handoff/outfit-league-product-detail-handoff/screen/png/product-detail-{viewport,full}.png. The accompanying HTML and README provide the layout and state specifications.

Implementation is the existing outfit/[id] route, with app UI in src/components/ExploreProduct.tsx. The preview uses the existing catalog record for MINI BELFAST Melange Brown, Italian Textured Flannel. Its temporary local QA response uses the supplied sample photo so the asset crop matches the reference. Production continues using each record's retailer photo.

### Evidence and density

- Source viewport is 1170 × 2532, normalized to 390 × 844 at 1×.
- Source full view is 1170 × 3450, normalized to 390 × 1150 at 1×.
- Browser captures use deviceScaleFactor 1. Initial view is qa/product-detail/390-final.jpg. Full composition is qa/product-detail/390-full-final.jpg.
- Paired comparisons are qa/product-detail/comparison-final.png and qa/product-detail/comparison-full-final.png, with source on the left.
- Focused details comparison is qa/product-detail/comparison-details.png. Footer clearance is qa/product-detail/390-bottom.jpg.
- Responsive checks at 375 × 844 and 430 × 844 are recorded in qa/product-detail/375.jpg and 430.jpg. Neither showed horizontal overflow. Both persistent actions measured at least 62 points high.

### Comparison history

The first comparison found a P2 spacing mismatch. The title and price sticker pushed the Shop card down by approximately six points. Title spacing, price line height and sticker padding were corrected. The initial retailer image had a different source crop, so the local fixture was changed to the supplied photo for the controlled comparison. The normal route continues to use retailer data.

The revised comparison found a P2 mismatch in the action-bar fade and style-sticker height. Both were adjusted to match the supplied PNG. The final paired captures were opened and reviewed at the same viewport and settled animation state. There are no remaining actionable P0/P1/P2 visual findings.

### Required fidelity surfaces

- Typography uses the app's bundled Bricolage Grotesque 800 and Figtree families. The full product name wraps across three lines for the reference record and is never truncated. Eyebrow, price, Shop card and detail hierarchy follow the reference.
- Spacing preserves the 486-point hero, 20-point side margins, rounded surfaces and 62-point actions. The footer scrolls fully above the persistent action bar.
- Colors use the app tokens and supplied mint, pink, yellow and lavender detail fills.
- Imagery uses the supplied photo for controlled QA and record-specific retailer photos in production. Hero cover positioning is 50% / 30%. UI icons use existing icon libraries.
- Copy removes the repeated header title, generic description, raw Tags line and separate Source line. Fabric, cut and color are parsed only from supported tag prefixes. Missing values remain hidden.

### Interaction and state checks

Explore search → product → Back returned to Explore. Shop opened the original Frank & Eileen product URL. Guest Save and Try On both opened the existing sign-in route. The save mutation, saved-item navigation and garment preselection handlers were retained and reviewed. Authenticated save and physical-iPhone execution were not exercised in this browser session.

Local fixtures verified missing price, missing store link, missing details, loading, and failed product-image states. Reduced-motion handling suppresses animations and press displacement, with a conservative initial motion preference. The normal product route produced no browser console errors.

App typecheck and eight product-detail/catalog tests passed.

### Follow-up polish

Existing native icon shapes differ slightly from the handoff's custom SVG strokes. Platform font rasterization and shadows vary slightly. These are P3 differences.

final result: passed
