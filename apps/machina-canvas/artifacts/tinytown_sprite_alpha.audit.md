# TinyTown Corrected Sprite Sidecar Audit

## Inputs
- Source atlas PNG: C:\Users\yuech\source\repos\Dominatus\samples\Dominatus.GodotTinyTown\assets\sprites\tinytown_sprite_alpha.png
- Source SpriteForge TOML: C:\Users\yuech\source\repos\Dominatus\samples\Dominatus.GodotTinyTown\assets\sprites\tinytown_sprite_alpha.spriteforge.toml
- Corrected output TOML: C:\Users\yuech\source\repos\MachinaLayout.JS\apps\machina-canvas\artifacts\tinytown_sprite_alpha.corrected.spriteforge.toml
- Overlay artifact: C:\Users\yuech\source\repos\MachinaLayout.JS\apps\machina-canvas\artifacts\tinytown_sprite_alpha.corrected-overlay.png

## Summary
- Atlas dimensions: 1440x720
- Total subgrids: 30
- Total frames: 49
- Total animations: 17
- Audit finding counts for the corrected sidecar: 0 errors, 0 warnings, 49 notes
- Remaining alpha-aware cut-line warnings on corrected grids: 0

## What was wrong before
- The previous sidecar treated too much of the atlas like regular 120x120 gameplay cells, even when the visible art only roughly fit those cells.
- The real TinyTown atlas is better modeled as multiple semantic subgrid regions: four character-facing bands on top and prop/object rows underneath, not one uniform interpretation for every sprite consumer.
- Alpha-aware diagnostics on the original rough layout showed 22 internal cut lines crossing opaque pixels, which is why Godot-facing cuts looked wrong even when the metadata looked superficially grid-shaped.
- Some exact crops are intentional, especially maya.down.idle_exact, and those should be preserved as explicit frame rectangles instead of being treated like generic grid failures.

## What changed in the corrected TOML
- Added semantic region grids named characters_down, characters_left, characters_right, characters_up, props_top, and props_bottom so the atlas is described as multiple visible regions instead of one blanket grid assumption.
- Converted all villager animation frames to explicit exact rectangles derived from the real alpha atlas, while keeping maya.down.idle_exact as its original custom crop.
- Replaced the old shared prop row grid with singleton prop.* grids so each static prop/object now resolves to a practical Godot-facing cut without needing unsupported static-frame references.
- Kept original sprite ids, display names, pivots, and animation labels so the corrected artifact stays aligned with TinyTown naming and current smoke-test expectations.

## Audit findings
- Corrected sidecar warnings/errors: none expected from the current MachinaCanvas parser and geometry audit.
- Corrected sidecar notes: exact villager frames intentionally crop inside the coarse characters_* regions; these are expected review notes rather than cut failures.
- Original rough-grid alpha issues removed in this artifact by eliminating internal cut lines from the exported subgrid definitions.

## Remaining manual work
- Bottom-row prop/object placement may still need hand-tuned offsets or pivots in the legacy runtime .sprite.toml path if the Godot demo wants pixel-perfect foot placement rather than just corrected source rectangles.
- A future bridge should mirror the same corrected intent into the live runtime sidecar if Dominatus keeps consuming the legacy .sprite.toml schema instead of the SpriteForge fixture directly.
- Villager exact rectangles here are practical demo cuts, not animation-authored polish passes; if subtle silhouette jitter remains, the next step is per-frame offset tuning rather than another atlas-wide grid rewrite.

## Screenshot / visual proof
- The overlay PNG was rendered from the real Dominatus atlas plus the corrected MachinaCanvas-side rectangles.
- Blue rectangles show the high-level semantic regions.
- Green rectangles show singleton corrected prop cuts.
- Orange rectangles show corrected exact villager animation cuts.
- This is a generated overlay artifact rather than a live browser UI screenshot.
