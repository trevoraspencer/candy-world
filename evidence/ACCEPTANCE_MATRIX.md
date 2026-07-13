# Candy World Acceptance Matrix

Final evidence ledger for `CANDY_WORLD_SUPERGOAL.md`. Automated evidence is
provided by `node --test`; browser evidence was collected in a real WebGL2
in-app browser at build 91. Recovery warnings are intentional diagnostics; all
ordinary fresh, streamed, stress, and migrated-world runs had no new warnings or
errors.

| Item | State | Evidence-backed acceptance |
|---:|---|---|
| 1 | Accepted | DPR/render-scale helper tests cover 50/75/100% and DPR 2; Settings browser flow persisted 75% then restored 100%; build 87 surface p95 17.8 ms. |
| 2 | Accepted | Material-specific 16×16 atlas functions, stable coordinate variants, shared inventory icons; `phase-03/` day/night captures and final build captures show seam-free distinct wafer, crumb, stone, wood, glass, frosting, and ore art. |
| 3 | Accepted | Five biome palettes/silhouettes, deterministic exclusive props and trees in main and worker generation; worker ecology/prop tests; `streamed-ecology-build71.png` and `final-grounded-travel-build89.png`. |
| 4 | Accepted | Separate sky/block light channels, sky-height cache, bounded emissive invalidation, sun direction; gameplay browser audit reports `crossChunkLight:pass,lightRemoval:pass`; cave capture `cave-lighting-build72.png`. |
| 5 | Accepted | Layered procedural sky, sun/moon/stars/clouds, four deterministic biome-valid weather states; automated weather test; heavy weather p95 18.0 ms vs 16.8 baseline (7.1%); `heavy-weather-build72.png`. |
| 6 | Accepted | Opaque/translucent passes, depth-write control, chunk sorting, glass material, animated liquids, underwater palette; fresh/legacy/streamed captures and zero WebGL errors at target view distance. |
| 7 | Accepted | Held item/hand, walk bob, sprint FOV, landing and verb actions, persistent FOV/sensitivity/motion controls; keyboard inventory→Escape→Pause→Escape browser flow proved presentation and pointer state recover cleanly. |
| 8 | Accepted | Eight attached world crack stages, material debris, placement/interaction feedback, bounded colored particle arrays; action hooks run synchronously from input and stress scene stayed bounded. |
| 9 | Accepted | Gesture-gated single AudioContext, deterministic original tones/noise, surface footsteps, swings, break/place, pickup, food, craft/oven, UI, quest, trade, tame/breed, sleep, mechanism, weather and damage events; persistent three-bus volume settings; unavailable audio fails silently. |
| 10 | Accepted | Generated pixel meters/icons, item label, F3-gated debug, compact rail, semantic HUD controls; desktop plus `hud-live-200pct-320px-fixed-build67.png`; 320 px/200% layout repaired and verified. |
| 11 | Accepted | Valid-save title gating, confirmations, pause/settings/controls/save status, staged tutorial, full settings and remaps; browser keyboard flow closes the topmost dialog before pausing and resumes with Escape. |
| 12 | Accepted | Deterministic safe-spawn scoring, destructive foliage clearing only for new worlds, marker, guaranteed tree and cave entrance, persisted authored spawn diffs; Survival empty hands and Cozy basket rules. |
| 13 | Accepted | Immutable creation-time Survival/Cozy/Creative rules; flight limited to Creative, hostile/damage/death differences enforced, HUD toggle explains immutability, Creative remains searchable and unlimited. |
| 14 | Accepted | Tier gates/yields, deterministic drops, six tool tiers, persistent durability across mining/combat/hoeing, bars/tooltips; damage tier and metadata transaction tests; browser Creative tool filter capture. |
| 15 | Accepted | Physical gravity/delay/merge/magnet/pickup/cap/full-inventory behavior plus checkpoint serialization; gameplay browser audit reports `pickup:pass`; 192-drop stress population verified. |
| 16 | Accepted | Border-stable density caves, entrances, depth ores, underground Deep Dark, sprinkle geodes, wafer mines and caramel drips in main/worker parity; dedicated worker feature test and cave capture. |
| 17 | Accepted | Block-vs-mob arbitration, reach/wall ordering, tier damage, cooldown, knockback, i-frames, exact-once death/loot, player hazards/death/respawn; sword tests, 30/60/144 integration test, quarter-block hitch substeps; gameplay audit `combat:pass`. |
| 18 | Accepted | Darkness/light/sky/distance/protected spawn manager, dusk warning, dawn retreat/despawn, bed spawn/sleep and persisted time; gameplay audit `sleep:pass`; weather/night captures remain navigable. |
| 19 | Accepted | Real 2×2/3×3 shaped grids, declared mirroring, atomic output/autofill/shift craft/remainders; shaped/malformed/overflow transaction tests; keyboard inventory and semantic grid browser walkthrough. |
| 20 | Accepted | Persistent timed Candy Oven with fuels, blocking, progress, five-minute offline cap, contents drop and emissive state; reload/overflow/fuel tests; gameplay browser audit `oven:pass`. |
| 21 | Accepted | Nine utilities craft/place/orient/interact/collide/save/drop; transactional chest; state-aware partial meshes/collision for doors/fences/ladders/signs/slabs/stairs/beds; `utility-shapes-build82.png`. |
| 22 | Accepted | Hydrated fixed-tick crops, renewable harvest/replant drops, deterministic growth helper, breeding cooldown/babies/population caps and persistent entity state; crop test; gameplay audit `farming:pass`. |
| 23 | Accepted | Four seeded structure families with biome preferences, rotation, safe siting, non-overlap, persistent feature edits/chests/loot; order-independence test; DOM reported all four families; `all-structure-families-build75.png`. |
| 24 | Accepted | Bounded switch/plate/wire/delay/lamp/door/note system, 512-work cap, cycle guard, persistence and border-safe world access; propagation test; gameplay audit `mechanism:pass`. |
| 25 | Accepted | Six dependency branches, discovery/locked UI, event-bus progress, tier-safe rewards, legacy IDs and explicit Creative-only policy; every live quest completes in tests; `quest-branches-build37.png`. |
| 26 | Accepted | Deterministic villager identity/profession/trades/reputation, ambient species reactions, persistent pet commands/recovery and persistent babies/cooldowns; seed/order test; 80-mob/192-drop browser population at 16.8 ms p95. |
| 27 | Accepted | Semantic grids, half/single right-click, atomic drag, predictable shift transfer, double-click collection, durability/tooltips, Creative search/categories and safe cursor return; conservation tests and browser keyboard/small-screen evidence. |
| 28 | Accepted | Three isolated named slots, seed/version metadata, independent feature streams, duplicate/delete/export/import with sanitize/reject path, legacy seed/version; terrain/structure/mob/villager order tests and migrated legacy build 89. |
| 29 | Accepted | Movement/time/rule dirtiness, baseline compaction, lifecycle flush, chunk-indexed edits, split two-generation IndexedDB checkpoint and visible recovery; 100k-edit grouping/round-trip and generation-race tests; build 90 recovered previous checkpoint at 61 FPS. |
| 30 | Accepted | Fixed 60 Hz accumulator, render separation, ≤0.25-block substeps, 2,048 world, configurable active/prefetch/unload rings, two-worker terrain/mesh transfers, revision-rejected stale meshes and GPU disposal; 1,024-block return restored edit with 261 chunks capped, queues zero, 16.9 ms p95 and no errors. |

## Final browser metrics

- Fresh seeded build 87: 225 loaded / 49 meshed, queues 0/0, 61 FPS,
  median 16.7 ms, p95 17.8 ms, all four structure families.
- Heavy weather: 61 FPS, median 16.7 ms, p95 18.0 ms.
- Cave lighting: 61 FPS, median 16.7 ms, p95 18.4 ms.
- 80 mobs + 192 drops: population `80,192`, 61 FPS, p95 16.8 ms.
- Returned 1,024-block travel: 261 loaded / 49 meshed, queues 0/0,
  marker `restored`, 61 FPS, p95 16.9 ms.
- Migrated legacy build 89: inventory/location playable, 61 FPS, p95 16.8 ms.
- Interrupted checkpoint build 90: visible previous-checkpoint recovery, playable,
  61 FPS, p95 16.8 ms.
- Gameplay system build 91: cross-chunk light, removal, oven, farming,
  mechanism, combat, pickup, and sleep all reported `pass`.

