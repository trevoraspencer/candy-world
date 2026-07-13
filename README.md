# Sweet, Sweet World

A candy-themed voxel sandbox built in vanilla HTML/CSS/JavaScript and WebGL2.
No build step, no dependencies, fully offline — just open the file and play.

![Tech: vanilla JS](https://img.shields.io/badge/tech-vanilla%20JS-f7df1e)
![Renderer: WebGL2](https://img.shields.io/badge/renderer-WebGL2-990000)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- 2048×64×2048 seeded voxel world streamed in 16×16 chunks by two Web Workers
- Five candy ecologies, scheduled weather, caves, underground Deep Dark, geodes, and wafer mines
- Four deterministic structure families with persistent contained treasure
- DPR-aware WebGL2 rendering with scalable quality, block/sky light, transparent passes, and partial block geometry
- Mining, placing, crafting, and a 36-slot inventory with hotbar
- Mobs (pigs, cows, sheep, chickens, goats, unicorns, the warden)
  with separation/avoidance behavior and warden flee mechanics,
  plus trader villagers
- Pet taming with treats, follower pets, name tags, a pet panel,
  unicorn sparkle effects, and saved pets
- Creative worlds with searchable categories, all blocks/items, flight,
  non-depleting inventory, and an explicit world-creation rule
- Six-branch Quest Book with dependency-aware teaching quests, safe rewards,
  a HUD icon, and `Q` shortcut
- Survival, Cozy Survival, and Creative world rules; combat, death/respawn, farming, breeding, and mechanisms
- Persistent shaped crafting, Candy Ovens, chests, doors, fences, ladders, signs, slabs, stairs, beds, and lamps
- Day/night cycle, biome weather, procedural offline audio, particles, status effects, and accessible health/hunger meters
  with a gentle Survival loop: exploring, sprinting, jumping, and mining
  drain hunger; being well-fed heals; an empty hunger meter causes a
  non-lethal sugar crash until you snack again
- Three named world slots plus duplicate/delete/export/import; legacy-save migration; split, two-generation IndexedDB checkpoints with local fallback and recovery diagnostics
- Built-in performance instrumentation (frame timing via `performance.mark`/`measure`; console logging is off by default — set `ENABLE_PERF_LOGS = true` in `js/render.js` to print a summary every 60 frames)

## Running it

The simplest path: open `index.html` directly in a modern browser.

If your browser blocks local `file://` resource loads, serve the directory:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

A WebGL2-capable browser is required (Chrome, Firefox, Safari 15+, Edge).

## Controls

**Movement**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Space` | Jump |
| Double-tap `Space` | Toggle flight (Creative only) |
| `Shift` | Sprint |
| `Shift` / `Ctrl` (while flying) | Descend |

**Interaction**

| Key | Action |
| --- | --- |
| Hold `R` | Mine block under crosshair |
| `F` | Place selected hotbar block |
| Right-click Crafting Table | Open advanced crafting UI |
| Right-click Furnace | Open smelting UI |
| `T` | Trade with villager under crosshair |
| Treat in hand + click animal | Tame a pet |

**Inventory**

| Key | Action |
| --- | --- |
| `1`–`9` | Select hotbar slot |
| Mouse wheel | Cycle hotbar slots |
| `E` | Open / close inventory |
| `P` or pet HUD button | Open / close pet panel |
| `Q` or quest HUD icon | Open / close Quest Book |
| Settings | Remap movement, mining, placement, inventory, pets, and quests |
| `H` or `?` | Show / hide controls overlay |

Click the canvas once on first load to lock the pointer and enable mouse look.

## Validation

Check JavaScript syntax with:

```sh
node --check js/*.js test/*.js
node --test
```

Then serve the game locally and verify it loads:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project layout

```
index.html         entry point — loads scripts in dependency order
css/style.css      HUD, inventory, crafting, and trade UI
js/math.js         matrix / vector helpers
js/noise.js        value noise + fbm
js/blocks.js       BLOCK_REGISTRY, block ids, atlas tile indices, names
js/items.js        non-block item ids, generated icon canvases
js/state.js        game singleton — central mutable state (world, player, inventory, mobs, effects, etc.)
js/effects.js      day/night cycle, status effects, particles
js/tools.js        tool / material multipliers
js/crafting.js     recipes and crafting UI
js/mobs.js         mob types, AI, meshing, villager trading
js/webgl.js        GL context, shared GLSL constants, texture atlas
js/world.js        chunk storage, terrain generation, meshing
js/persistence.js  schema migration, sanitization, save serialization
js/persistence-db.js crash-safe split IndexedDB checkpoints
js/chunk-streaming.js / js/chunk-worker.js worker generation, meshing, and bounded rings
js/player.js       collision, raycast, frustum, inventory UI
js/input.js        keyboard, mouse, pointer lock, hotbar
js/quests.js       Quest Book definitions, progress, rewards, and UI
js/render.js       main render loop, draw passes
js/main.js         bootstrap
```

Scripts are loaded as classic `<script>` tags and share a single global
scope. There is no bundler, no transpiler, and no package.json — editing a
file and reloading the page is the full development loop.

## License

MIT. See [`LICENSE`](./LICENSE).
