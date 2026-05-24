# merge-game — project context for Claude

## What this is
A casual merge puzzle game built as a PWA for Svetlana's iPad. No App Store, installs via Safari "Add to Home Screen". Hosted on GitHub Pages.

**Live URL:** https://baalurad.github.io/merge-game/
**Repo:** https://github.com/Baalurad/merge-game
**Local dev:** `python -m http.server 8765` from project root

## Tech stack
- **Phaser 3.70** via CDN — game engine, canvas rendering, tween animations
- **Vanilla JS** (no build step) — files served directly as static assets
- **Service Worker** (`sw.js`) — offline caching, keyed by `APP_VERSION`
- **GitHub Pages** — free static hosting from `master` branch root

## Target devices
- **iPad 12.9" 2017** (primary): 1024×1366 CSS pt (2048×2732 physical, 2x retina)
- **iPhone 17**: 402×874 CSS pt (1206×2622 physical, 3x)

## Canvas & grid
- Canvas: **720×1280** (Phaser Scale.FIT — scales to fill device)
- Grid: **7 columns × 9 rows**, GAP=8px
- Cell size: ~90px on canvas → ~96 CSS pt on iPad → ~192 physical px on iPad
- Sprite native size: **192×192px** (ELEM_SCALE = (CELL_SIZE - 12) / 192)

## Versioning
Single source of truth: `version.js` → `const APP_VERSION = '0.1.3'`
Bump this on every release. The SW cache name is `merge-game-${APP_VERSION}`, so bumping forces a cache refresh on the player's device.

## Board data model
`board[row][col]` is an object `{ level, type }`:
- `level: -1, type: N` — basket of type N
- `level: 0, type: null` — empty cell
- `level: 1–8, type: N` — element produced by basket type N

Elements can only merge if **same level AND same type**.

## Basket configs (`BASKET_CONFIGS` array in GameScene.js)
Each entry: `{ color, labelColor, elemColors[1..8] }`
- Index 0: amber/warm palette (yellows, reds, oranges)
- Index 1: purple/cool palette (blues, teals, purples)

Future basket types: just push a new config entry.

## Key mechanics
- **Tap basket** → spawns level-1 element in a random empty cell within the 3×3 neighborhood
- **Drag basket** → move >20px triggers basket relocation (movement-based, no timer)
- **Drag element** → drop on same-level same-type element to merge into level+1; drop on empty cell to move
- **Game over** when grid is full and no same-type same-level pair exists anywhere

## Order system
- Panel between header and grid; up to 4 simultaneous orders
- Orders spawn every 20s; if the board is empty → new order after 1s
- Order type is uniformly random among unlocked basket types only
- Fulfilling an order scores `level × 50`; expiry (45s) costs −50 points

## Pending tasks
1. ~~Multiple baskets + movement-based drag~~ ✓
2. ~~Customer / order system~~ ✓
3. Sprites — replace colored rectangles with themed PNG chains per basket type; **192×192px**, generated via AI API (Replicate / Recraft V3), downscaled with Lanczos + unsharp mask
4. Animation polish — particle burst on merge, arc travel when fulfilling orders

## Workflow
- Edit code → reload preview to verify → bump `version.js` → `git add . && git commit -m "vX.X.X: description" && git push`
- Preview server config: `.claude/launch.json` (serves on port 8765)
- Player gets update on next app launch with internet on
