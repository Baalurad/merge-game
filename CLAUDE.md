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

## Versioning
Single source of truth: `version.js` → `const APP_VERSION = '0.0.3'`
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
- **Hold basket 200ms → drag** → drop on empty cell to relocate basket
- **Drag element** → drop on same-level same-type element to merge into level+1; drop on empty cell to move
- **Game over** when grid is full and no same-type same-level pair exists anywhere

## Pending tasks (use Task tool to see current state)
1. ~~Multiple baskets + long-press move~~ ✓
2. Customer / order system — panel between score bar and grid; customers request specific type+level items
3. Pixel art sprites — replace colored rectangles; each basket type has a themed sprite chain (e.g. yellow=oranges, purple=berries); target 80×80px PNG
4. Animation polish — particle burst on merge, arc travel when fulfilling orders
5. Reduce basket long-press to 100ms

## Planned: Customer / order system (Task #2)
A strip between the header and the game board. Customers appear with orders like "level 4 amber + level 5 purple". Player drags matching elements to fulfill. This is the core game loop. Design TBD.

## Workflow
- Edit code → reload preview to verify → bump `version.js` → `git add . && git commit -m "vX.X.X: description" && git push`
- Preview server config: `.claude/launch.json` (serves on port 8765)
- Player gets update on next app launch with internet on
