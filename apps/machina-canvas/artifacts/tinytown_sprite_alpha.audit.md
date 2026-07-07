# TinyTown compiled sprite audit

- frame count: 72
- stackframe count: 12
- exact/manual frame count: 31
- findings: 19 (0 error, 15 warning, 4 note)

## TinyTown notes

- Manual prop crops are expected and may be intentional; verify crop bounds only if Godot review shows visible offset issues.
- Character exact overrides are reserved for the few non-`80x120` source cuts that still need explicit preservation.
- Bottom prop/object frames remain explicit on purpose so review can stay local instead of forcing them into synthetic stackframes.

# Sprite Audit Report

## High-level summary
- sprite sidecar id: tinytown-compiled
- linked image id: tinytown-sheet
- image dimensions: 1440x720
- atlas dimensions: 1440x720
- total subgrids: 0
- total stackframes: 12
- total sprites: 28
- total frames: 72
- total animations: 16
- total diagnostics / suspicious findings: 19 (0 error, 15 warning, 4 note)
- audit scope: all frames

## Subgrids
| Grid | X | Y | Cell | Rows | Cols | Frames |
| --- | ---: | ---: | --- | ---: | ---: | ---: |

## Stackframes
| stackframe | direction | count | step | frame size |
| --- | --- | ---: | ---: | --- |
| down.0 | vertical | 4 | 120 | 80x120 |
| down.1 | vertical | 4 | 120 | 80x120 |
| down.2 | vertical | 4 | 120 | 80x120 |
| left.0 | vertical | 4 | 120 | 80x120 |
| left.1 | vertical | 4 | 120 | 80x120 |
| left.2 | vertical | 4 | 120 | 80x120 |
| right.0 | vertical | 4 | 120 | 80x120 |
| right.1 | vertical | 4 | 120 | 80x120 |
| right.2 | vertical | 4 | 120 | 80x120 |
| up.0 | vertical | 4 | 120 | 80x120 |
| up.1 | vertical | 4 | 120 | 80x120 |
| up.2 | vertical | 4 | 120 | 80x120 |

## Frame list
| Frame | Source | Grid | Row | Col | Stackframe | Stack Index | Sprite | Animation | X | Y | W | H | Flags |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| arch | manual | - | - | - | - | - | arch | - | 854 | 609 | 116 | 107 | overlap |
| barrel | manual | - | - | - | - | - | barrel | - | 1111 | 479 | 69 | 115 | overlap |
| basket | manual | - | - | - | - | - | basket | - | 391 | 617 | 89 | 95 | - |
| bucket | manual | - | - | - | - | - | bucket | - | 274 | 618 | 70 | 88 | - |
| bush | manual | - | - | - | - | - | bush | - | 629 | 623 | 87 | 80 | - |
| campfire | manual | - | - | - | - | - | campfire | - | 23 | 623 | 94 | 81 | - |
| crate | manual | - | - | - | - | - | crate | - | 987 | 497 | 79 | 115 | - |
| fence | manual | - | - | - | - | - | fence | - | 742 | 637 | 98 | 62 | - |
| flowers | manual | - | - | - | - | - | flowers | - | 1214 | 498 | 96 | 106 | - |
| fountain | manual | - | - | - | - | - | fountain | - | 1105 | 614 | 86 | 92 | - |
| garden | manual | - | - | - | - | - | garden | - | 268 | 504 | 100 | 102 | - |
| heart | manual | - | - | - | - | - | heart | - | 1225 | 633 | 71 | 63 | - |
| home | manual | - | - | - | - | - | home | - | 379 | 486 | 120 | 121 | overlap |
| lina.down.0 | exact | - | - | - | - | - | lina | down | 38 | 249 | 79 | 120 | overlap |
| lina.down.1 | exact | - | - | - | - | - | lina | down | 155 | 250 | 79 | 120 | overlap |
| lina.down.2 | exact | - | - | - | - | - | lina | down | 272 | 250 | 79 | 120 | overlap |
| lina.right.2 | exact | - | - | - | - | - | lina | right | 989 | 246 | 77 | 120 | overlap |
| lina.up.0 | exact | - | - | - | - | - | lina | up | 1110 | 248 | 76 | 120 | overlap |
| lina.up.1 | exact | - | - | - | - | - | lina | up | 1220 | 248 | 76 | 120 | overlap |
| mailbox | manual | - | - | - | - | - | mailbox | - | 757 | 490 | 72 | 118 | overlap |
| market | manual | - | - | - | - | - | market | - | 147 | 490 | 100 | 115 | overlap |
| sack | manual | - | - | - | - | - | sack | - | 518 | 620 | 78 | 84 | - |
| signpost | manual | - | - | - | - | - | signpost | - | 640 | 493 | 76 | 118 | - |
| social | manual | - | - | - | - | - | social | - | 508 | 495 | 113 | 112 | - |
| speech_bubble | manual | - | - | - | - | - | speech_bubble | - | 1333 | 615 | 76 | 99 | - |
| stone | manual | - | - | - | - | - | stone | - | 982 | 629 | 87 | 70 | - |
| streetlamp | manual | - | - | - | - | - | streetlamp | - | 884 | 490 | 56 | 120 | overlap |
| table | manual | - | - | - | - | - | table | - | 145 | 623 | 92 | 83 | - |
| theo.left.2 | exact | - | - | - | - | - | theo | left | 635 | 137 | 66 | 120 | overlap |
| tree | manual | - | - | - | - | - | tree | - | 1327 | 493 | 90 | 120 | overlap |
| well | manual | - | - | - | - | - | well | - | 30 | 486 | 83 | 120 | overlap |
| maya.down.0 | stackframe | - | - | - | down.0 | 0 | maya | down | 40 | 12 | 80 | 120 | - |
| theo.down.0 | stackframe | - | - | - | down.0 | 1 | theo | down | 40 | 132 | 80 | 120 | overlap |
| nia.down.0 | stackframe | - | - | - | down.0 | 3 | nia | down | 40 | 372 | 80 | 120 | overlap |
| maya.down.1 | stackframe | - | - | - | down.1 | 0 | maya | down | 153 | 12 | 80 | 120 | - |
| theo.down.1 | stackframe | - | - | - | down.1 | 1 | theo | down | 153 | 132 | 80 | 120 | overlap |
| nia.down.1 | stackframe | - | - | - | down.1 | 3 | nia | down | 153 | 372 | 80 | 120 | overlap |
| maya.down.2 | stackframe | - | - | - | down.2 | 0 | maya | down | 272 | 12 | 80 | 120 | - |
| theo.down.2 | stackframe | - | - | - | down.2 | 1 | theo | down | 272 | 132 | 80 | 120 | overlap |
| nia.down.2 | stackframe | - | - | - | down.2 | 3 | nia | down | 272 | 372 | 80 | 120 | - |
| maya.left.0 | stackframe | - | - | - | left.0 | 0 | maya | left | 419 | 13 | 80 | 120 | - |
| theo.left.0 | stackframe | - | - | - | left.0 | 1 | theo | left | 419 | 133 | 80 | 120 | - |
| lina.left.0 | stackframe | - | - | - | left.0 | 2 | lina | left | 419 | 253 | 80 | 120 | - |
| nia.left.0 | stackframe | - | - | - | left.0 | 3 | nia | left | 419 | 373 | 80 | 120 | overlap |
| maya.left.1 | stackframe | - | - | - | left.1 | 0 | maya | left | 527 | 13 | 80 | 120 | - |
| theo.left.1 | stackframe | - | - | - | left.1 | 1 | theo | left | 527 | 133 | 80 | 120 | - |
| lina.left.1 | stackframe | - | - | - | left.1 | 2 | lina | left | 527 | 253 | 80 | 120 | - |
| nia.left.1 | stackframe | - | - | - | left.1 | 3 | nia | left | 527 | 373 | 80 | 120 | - |
| maya.left.2 | stackframe | - | - | - | left.2 | 0 | maya | left | 626 | 13 | 80 | 120 | - |
| lina.left.2 | stackframe | - | - | - | left.2 | 2 | lina | left | 626 | 253 | 80 | 120 | overlap |
| nia.left.2 | stackframe | - | - | - | left.2 | 3 | nia | left | 626 | 373 | 80 | 120 | - |
| maya.right.0 | stackframe | - | - | - | right.0 | 0 | maya | right | 766 | 16 | 80 | 120 | - |
| theo.right.0 | stackframe | - | - | - | right.0 | 1 | theo | right | 766 | 136 | 80 | 120 | - |
| lina.right.0 | stackframe | - | - | - | right.0 | 2 | lina | right | 766 | 256 | 80 | 120 | - |
| nia.right.0 | stackframe | - | - | - | right.0 | 3 | nia | right | 766 | 376 | 80 | 120 | overlap |
| maya.right.1 | stackframe | - | - | - | right.1 | 0 | maya | right | 880 | 16 | 80 | 120 | - |
| theo.right.1 | stackframe | - | - | - | right.1 | 1 | theo | right | 880 | 136 | 80 | 120 | - |
| lina.right.1 | stackframe | - | - | - | right.1 | 2 | lina | right | 880 | 256 | 80 | 120 | - |
| nia.right.1 | stackframe | - | - | - | right.1 | 3 | nia | right | 880 | 376 | 80 | 120 | overlap |
| maya.right.2 | stackframe | - | - | - | right.2 | 0 | maya | right | 987 | 16 | 80 | 120 | - |
| theo.right.2 | stackframe | - | - | - | right.2 | 1 | theo | right | 987 | 136 | 80 | 120 | overlap |
| nia.right.2 | stackframe | - | - | - | right.2 | 3 | nia | right | 987 | 376 | 80 | 120 | - |
| maya.up.0 | stackframe | - | - | - | up.0 | 0 | maya | up | 1117 | 16 | 80 | 120 | - |
| theo.up.0 | stackframe | - | - | - | up.0 | 1 | theo | up | 1117 | 136 | 80 | 120 | overlap |
| nia.up.0 | stackframe | - | - | - | up.0 | 3 | nia | up | 1117 | 376 | 80 | 120 | overlap |
| maya.up.1 | stackframe | - | - | - | up.1 | 0 | maya | up | 1214 | 16 | 80 | 120 | - |
| theo.up.1 | stackframe | - | - | - | up.1 | 1 | theo | up | 1214 | 136 | 80 | 120 | overlap |
| nia.up.1 | stackframe | - | - | - | up.1 | 3 | nia | up | 1214 | 376 | 80 | 120 | - |
| maya.up.2 | stackframe | - | - | - | up.2 | 0 | maya | up | 1329 | 16 | 80 | 120 | - |
| theo.up.2 | stackframe | - | - | - | up.2 | 1 | theo | up | 1329 | 136 | 80 | 120 | - |
| lina.up.2 | stackframe | - | - | - | up.2 | 2 | lina | up | 1329 | 256 | 80 | 120 | - |
| nia.up.2 | stackframe | - | - | - | up.2 | 3 | nia | up | 1329 | 376 | 80 | 120 | overlap |

## Alpha-aware cut analysis
| Grid | Line | Coordinate | Boundary | Opaque hits | Finding |
| --- | --- | ---: | --- | ---: | --- |
| - | - | - | - | - | Alpha-aware cut analysis was skipped in this scripted pass because the compiled runtime artifact intentionally omits guide grids and no DOM alpha mask was built. |

## Guide-region constraints
- No guide-region warnings in the current audit scope.

## Suspicion analysis
- [warning] arch overlaps streetlamp. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] barrel overlaps nia.up.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] home overlaps nia.left.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.down.0 overlaps theo.down.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.down.1 overlaps theo.down.1. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.down.2 overlaps theo.down.2. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.right.2 overlaps theo.right.2. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.up.0 overlaps theo.up.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] lina.up.1 overlaps theo.up.1. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] mailbox overlaps nia.right.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] market overlaps nia.down.1. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] streetlamp overlaps nia.right.1. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] theo.left.2 overlaps lina.left.2. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] tree overlaps nia.up.2. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [warning] well overlaps nia.down.0. Why: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels. Suggested next step: Separate the frame bounds unless this overlap is intentional.
- [note] Animation theo.left mixes exact/custom crop frames with generated runtime frames. This may be intentional, but may cause visual jitter if dimensions are expected to match. Why: Atlases often use a tighter idle crop beside full generated frames; that mix is valid but can shift silhouettes if playback expects uniform extents. Suggested next step: Verify whether the mixed crop sizes are intentional for this animation and normalize only if playback should stay dimensionally stable.
- [note] Animation lina.right mixes exact/custom crop frames with generated runtime frames. This may be intentional, but may cause visual jitter if dimensions are expected to match. Why: Atlases often use a tighter idle crop beside full generated frames; that mix is valid but can shift silhouettes if playback expects uniform extents. Suggested next step: Verify whether the mixed crop sizes are intentional for this animation and normalize only if playback should stay dimensionally stable.
- [note] Alpha-aware cut analysis was skipped in this scripted pass because the compiled runtime artifact intentionally omits guide grids and no DOM alpha mask was built. Why: Alpha-aware cut validation needs readable image pixels from the source atlas before it can inspect transparent gutters. Suggested next step: Use a same-origin or local image asset, or continue with geometric audit findings only.
- [note] Animation lina.up mixes exact/custom crop frames with generated runtime frames. This may be intentional, but may cause visual jitter if dimensions are expected to match. Why: Atlases often use a tighter idle crop beside full generated frames; that mix is valid but can shift silhouettes if playback expects uniform extents. Suggested next step: Verify whether the mixed crop sizes are intentional for this animation and normalize only if playback should stay dimensionally stable.

## Likely issues found
- WARNING [arch] arch overlaps streetlamp.
- WARNING [barrel] barrel overlaps nia.up.0.
- WARNING [home] home overlaps nia.left.0.
- WARNING [lina.down.0] lina.down.0 overlaps theo.down.0.

## Why previous cuts were probably wrong
- arch: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels.
- barrel: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels.
- home: Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels.

## What to adjust next
- arch: Separate the frame bounds unless this overlap is intentional.
- barrel: Separate the frame bounds unless this overlap is intentional.
- home: Separate the frame bounds unless this overlap is intentional.
