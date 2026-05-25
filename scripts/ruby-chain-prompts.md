# Ruby chain — промпты и оценки

## Модель и параметры
- Model: `recraft-ai/recraft-v3` via Replicate
- Style: `digital_illustration`
- Resolution: 1024×1024 → downscale 192×192 (Lanczos3)
- Post-processing: 5-pass pipeline (flood-fill bg removal + enclosed regions + fringe feather + shadow removal + programmatic outline)
- Outline: 1px programmatic (dilation от альфа-маски) — протестировано на рубинах, результат ок. Бэкап до обводки: `assets/ruby-cartoon-backup/`

## Style anchor (добавляется к каждому промпту)
```
glossy cartoon mobile game icon, thick black outline bold linework,
vibrant saturated colors, brilliant gemstone sparkle and light reflections,
luxury opulent jewelry, soft inner glow on gemstone surfaces,
subtle drop shadow beneath item, white background,
centered composition, no text no labels no extra objects
```

## Уровни

| # | Файл | Промпт (item desc) | Итерации | Оценка |
|---|---|---|---|---|
| 1 | ruby_1.png | `a tiny rough uncut ruby mineral chip, dull dark red, jagged irregular shape, raw unpolished stone, very small` | 2 | ✅ Похож на кусок камня с блеском. Крупноват для "осколка" но терпимо |
| 2 | ruby_2.png | `a small smooth polished ruby pebble, oval rounded shape, deep red glossy surface, no facets` | 1 | ✅ Чистый кабошон, читается хорошо |
| 3 | ruby_3.png | `a brilliant-cut ruby gemstone, vivid deep red, many sharp triangular facets, strong light sparkle and reflections, floating centered` | 1 | ✅ Отлично — facets читаются, sparkle есть |
| 4 | ruby_4.png | `a simple yellow gold ring with one small round ruby in a four-prong setting, thin delicate band, three-quarter view angle` | 1 | ✅ Классическое кольцо, дырка прозрачная после постобработки |
| 5 | ruby_5.png | `an ornate yellow gold signet ring with a large oval ruby, wide band with decorative floral engraving, three-quarter view angle` | 1 | ✅ Богатый перстень, явный апгрейд от L4 |
| 6 | ruby_6.png | `a single gold stud earring with a round faceted ruby, martini-style bezel setting, front-facing flat view, no pin visible, centered, isolated single item` | 3 | ⚠️ Иголка чуть торчит, смещает центр. Терпимо. Попытки убрать только ухудшали |
| 7 | ruby_7.png | `an elegant gold drop earring, a faceted teardrop ruby pendant hanging from a small gold loop, front-facing view` | 1 | ✅ Чистая подвеска, читается |
| 8 | ruby_8.png | `a gold necklace with a large ruby teardrop pendant, chain in a U-shape, front view, ONLY the necklace, absolutely nothing else in the image, no extra stones no decorations outside the necklace` | 3 | ✅ Модель упорно добавляла лишние камни рядом. "ONLY the necklace" помогло |
| 9 | ruby_9.png | `a delicate gold tiara adorned with multiple rubies, symmetrical front-facing view, elegant curved headpiece, ornate filigree` | 1 | ✅ Красивая тиара, симметричная |
| 10 | ruby_10.png | `a magnificent royal gold crown lavishly set with large rubies and diamond accents, ornate filigree, symmetrical front-facing view, majestic and opulent` | 2 | ✅ Первая итерация была в стиле гравюры. Вторая — cartoon, богатая |

## Паттерны и выводы

**Что работает:**
- Явное указание вида: `front-facing view`, `three-quarter view angle`
- Запрет лишнего: `ONLY the necklace`, `no extra stones`, `isolated single item`
- `brilliant`, `luxury`, `opulent` — добавляют блеск и детали
- `martini-style bezel` точнее чем `four-prong setting` для гвоздика

**Что не работает:**
- Ожерелья/комплекты — модель хочет рисовать весь set. Нужен явный запрет.
- `no pin visible` для гвоздика — модель игнорирует, иголка всё равно есть
- Первые попытки давали фотореализм для серёжки → добиться cartoon стиля помогло несколько итераций

**Постобработка (scripts/gen-sprites.js → removeWhiteBackground):**
- Pass 1: flood-fill с углов → убирает внешний фон
- Pass 2: ищет крупные замкнутые белые области (≥40px) → убирает дырки в кольцах
- Pass 3: feather на границе прозрачного — снижает альфу ярких пикселей (brightness > 190)
