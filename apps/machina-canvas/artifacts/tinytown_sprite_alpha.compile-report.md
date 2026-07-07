# TinyTown sprite compile report

## Sources

- source atlas PNG: C:\Users\yuech\source\repos\Dominatus\samples\Dominatus.GodotTinyTown\assets\sprites\tinytown_sprite_alpha.png
- source runtime TOML reference: C:\Users\yuech\source\repos\Dominatus\samples\Dominatus.GodotTinyTown\assets\sprites\tinytown_sprite_alpha.sprite.toml
- source SpriteForge TOML reference: C:\Users\yuech\source\repos\Dominatus\samples\Dominatus.GodotTinyTown\assets\sprites\tinytown_sprite_alpha.spriteforge.toml
- public MachinaCanvas fixture image: C:\Users\yuech\source\repos\MachinaLayout.JS\apps\machina-canvas\public\assets\tinytown_sprite_alpha.png

## Outputs

- guide TOML: C:\Users\yuech\source\repos\MachinaLayout.JS\apps\machina-canvas\artifacts\tinytown_sprite_alpha.guide.toml
- compiled runtime sprite TOML: C:\Users\yuech\source\repos\MachinaLayout.JS\apps\machina-canvas\artifacts\tinytown_sprite_alpha.compiled.sprite.toml
- guide regions: characters_down, characters_left, characters_right, characters_up, props_top, props_bottom
- generated stackframes: 12
- explicit manual/runtime frames: 31
- explicit character overrides preserved: 7
- bottom prop/object frames preserved explicitly: 12

## Runtime / authoring split

- `*.guide.toml` owns guide regions, datums, dimensions, and alignment marks.
- The compiled `*.sprite.toml` owns runtime stackframes, explicit frames, sprites, and animations.
- The compiled runtime artifact omits guide scaffolding and omits legacy `cut_grids`.

## Stackframes

- down.0
- down.1
- down.2
- left.0
- left.1
- left.2
- right.0
- right.1
- right.2
- up.0
- up.1
- up.2

## Exact/manual character overrides

- lina.down.0 (79x120 at 38,249)
- lina.down.1 (79x120 at 155,250)
- lina.down.2 (79x120 at 272,250)
- lina.right.2 (77x120 at 989,246)
- lina.up.0 (76x120 at 1110,248)
- lina.up.1 (76x120 at 1220,248)
- theo.left.2 (66x120 at 635,137)

## Explicit frames preserved

- arch (116x107 at 854,609)
- barrel (69x115 at 1111,479)
- basket (89x95 at 391,617)
- bucket (70x88 at 274,618)
- bush (87x80 at 629,623)
- campfire (94x81 at 23,623)
- crate (79x115 at 987,497)
- fence (98x62 at 742,637)
- flowers (96x106 at 1214,498)
- fountain (86x92 at 1105,614)
- garden (100x102 at 268,504)
- heart (71x63 at 1225,633)
- home (120x121 at 379,486)
- lina.down.0 (79x120 at 38,249)
- lina.down.1 (79x120 at 155,250)
- lina.down.2 (79x120 at 272,250)
- lina.right.2 (77x120 at 989,246)
- lina.up.0 (76x120 at 1110,248)
- lina.up.1 (76x120 at 1220,248)
- mailbox (72x118 at 757,490)
- market (100x115 at 147,490)
- sack (78x84 at 518,620)
- signpost (76x118 at 640,493)
- social (113x112 at 508,495)
- speech_bubble (76x99 at 1333,615)
- stone (87x70 at 982,629)
- streetlamp (56x120 at 884,490)
- table (92x83 at 145,623)
- theo.left.2 (66x120 at 635,137)
- tree (90x120 at 1327,493)
- well (83x120 at 30,486)

## Caveats

- Removed `maya.down.idle_exact` from the compiled artifact because the source extra sat outside the live atlas and the current UI has no remove action.
- Character runtime cuts now use three vertical `80x120` stackframes per facing region; prop/object frames remain explicit manual review artifacts.
- No missing animation references were found after runtime generation.
