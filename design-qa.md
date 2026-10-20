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
