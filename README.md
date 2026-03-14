# Sweet, Sweet World

A candy-themed voxel sandbox built in vanilla HTML/CSS/JavaScript and WebGL2.
No build step, no dependencies, fully offline — just open the file and play.

![Tech: vanilla JS](https://img.shields.io/badge/tech-vanilla%20JS-f7df1e)
![Renderer: WebGL2](https://img.shields.io/badge/renderer-WebGL2-990000)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- 256×64×256 voxel world (16×16 chunks) generated from value-noise terrain
- Five biomes: forest, mountains, plains, beaches, deep dark
- WebGL2 chunk meshing with ambient occlusion and frustum culling
- Mining, placing, crafting, and a 36-slot inventory with hotbar
- Mobs (pigs, cows, sheep, chickens, goats, unicorns, the warden)
  with separation/avoidance behavior and warden flee mechanics,
  plus trader villagers
- Pet taming with treats, follower pets, name tags, a pet panel,
  unicorn sparkle effects, and saved pets
- Creative Mode with a HUD toggle, `C` shortcut, all blocks/items,
  non-depleting inventory, survival inventory restore, and saved mode
- Quest Book with 10 kid-friendly quests, progress tracking, rewards,
  a HUD icon, and `Q` shortcut
- Day/night cycle, hunger, health, particles, status effects
- Save/load via `localStorage` (saved automatically as you play) with versioned format and migration support
- Built-in performance instrumentation (frame timing via `performance.mark`/`measure`, logged every 60 frames)

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
| Double-tap `Space` | Toggle flight |
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
| `C` or Creative HUD toggle | Switch Creative / Survival mode |
| `H` or `?` | Show / hide controls overlay |

Click the canvas once on first load to lock the pointer and enable mouse look.

## Validation

Check JavaScript syntax with:

```sh
node --check js/*.js
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
js/persistence.js  save / load to localStorage
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
