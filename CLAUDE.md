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
- Sprite native size: **192×192px** (ELEM_SCALE = (CELL_SIZE - 12) / 192)

## Versioning
Single source of truth: `version.js` → `const APP_VERSION = '0.1.5'`
Bump this on every release. The SW cache name is `merge-game-${APP_VERSION}`, so bumping forces a cache refresh on the player's device.

## Board data model
`board[row][col]` is an object `{ level, type }`:
- `level: -1, type: N` — basket of type N
- `level: 0, type: null` — empty cell
- `level: 1–maxLevel, type: N` — element produced by basket type N (maxLevel per type, up to 10)

Elements can only merge if **same level AND same type**.

## Basket configs (`BASKET_CONFIGS` array in GameScene.js)
Each entry: `{ color, labelColor, elemTextColor, spritePrefix, basketSprite, maxLevel }`
- Index 0: egg / henhouse_basket — amber, maxLevel 8 — starts on board
- Index 1: coffee / plantation_basket — purple, maxLevel 8 — unlocks via basket2Unlocked
- Index 2: potion / cauldron_basket — green, maxLevel 8 — unlocks via basket3Unlocked
- Index 3: ruby / ruby_basket — red, maxLevel 10, energyBased — starts on board
- Index 4: crystal / crystal_basket — blue, maxLevel 10 — unlocks via basket4Unlocked

## Basket unlock chain
- **basket2 (coffee):** completing 2 egg orders drops 2 coffee L1 items → merge them → coffee basket appears
- **basket3 (potion):** completing a coffee order drops potion L1 → merge two → potion basket appears
- **basket4 (crystal):** completing a ruby order drops crystal L1 → merge two → crystal basket appears
- State flags: `basket2Unlocked`, `basket3Unlocked`, `basket4Unlocked` — NOT persisted to localStorage (reset on reload)

Future basket types: push a new config entry, add sprites, add basketNUnlocked flag and trigger in fulfillOrder/performMerge.

## Key mechanics
- **Tap basket** → spawns level-1 element in a random empty cell within the 3×3 neighborhood
- **Drag basket** → move >20px from finger-down position triggers basket relocation; release without drag = spawn
- **Drag element** → drop on same-level same-type element to merge into level+1; drop on empty cell to move
- **Game over** when grid is full and no same-type same-level pair exists anywhere

## Order system
- Panel between header and grid; up to 4 simultaneous orders
- Orders spawn every 20s; if the board is empty → new order after 1s
- Order type is uniformly random among basket types **currently on the board** (dynamic, not hardcoded)
- Fulfilling an order scores `level × 50`; expiry (45s) costs −50 points

## Energy system (ruby only)
- Ruby basket (type 3) uses energy to spawn: each tap costs 1 energy
- Cap: 60, regen: 1 per minute (60 000 ms)
- Offline regen: on load, compute elapsed since `rubyLastSeen` and grant earned energy up to cap
- Persistence: `rubyEnergy` + `rubyLastSeen` in localStorage; saved on `pagehide` and `visibilitychange`
- Current energy shown as gold number in bottom-left corner of the ruby basket cell

## Ideas & Design

All concept files live in [`ideas/`](ideas/):

| Файл | Статус | Описание |
|---|---|---|
| [`ideas/chain-ruby.md`](ideas/chain-ruby.md) | ✅ Готово | Рубиновая цепочка, 10 уровней, спрайты в `assets/ruby-cartoon/` |
| [`ideas/chain-drops.md`](ideas/chain-drops.md) | ✅ Готово | Капли → кристалл (сапфир), спрайты в `assets/crystal-cartoon/` |
| [`ideas/chain-squares.md`](ideas/chain-squares.md) | 🔲 Концепт | Квадраты → корона (изумруд/аметист), идея жены |
| [`ideas/feature-customer-panel.md`](ideas/feature-customer-panel.md) | 🔧 В работе | Свайп-панель, мульти-товар, спрайты заказчиков, анимации |

Sprite generation pipelines:
- Ruby: [`scripts/gen-sprites.js`](scripts/gen-sprites.js), prompts in [`scripts/ruby-chain-prompts.md`](scripts/ruby-chain-prompts.md)
- Crystal: [`scripts/gen-crystal-sprites.js`](scripts/gen-crystal-sprites.js), prompts embedded in CHAIN array
- Basket variants: [`scripts/gen-crystal-baskets.js`](scripts/gen-crystal-baskets.js)

Design principles (readability, color uniqueness, per-level evaluation): [`ideas/design-principles.md`](ideas/design-principles.md)

## Pending tasks
1. ~~Multiple baskets + movement-based drag~~ ✓
2. ~~Customer / order system~~ ✓
3. ~~Sprites — ruby chain~~ ✓ ~~Crystal chain~~ ✓ — egg/coffee/potion still use colored rectangles
4. Animation polish — particle burst on merge, arc travel when fulfilling orders
5. Customer panel v2 — multi-item orders, horizontal swipe, customer sprites (see [`ideas/feature-customer-panel.md`](ideas/feature-customer-panel.md))

## Workflow
- Edit code → reload preview to verify → bump `version.js` → `git add . && git commit -m "vX.X.X: description" && git push`
- Preview server config: `.claude/launch.json` (serves on port 8765)
- Player gets update on next app launch with internet on
