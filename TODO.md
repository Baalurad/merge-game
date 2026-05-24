# merge-game — TODO

## Спрайты

- [ ] Нагенерить 4 цепочки по 8 спрайтов через ChatGPT (DALL-E 3)
  - Яйца/Завтрак — корзинка «Курятник / Henhouse»
  - Кофе — корзинка «Плантация / Plantation»
  - Зелья — корзинка «Котёл / Cauldron»
  - Кристаллы — корзинка «Шахта / Mine»
- [ ] Нарезать спрайт-листы на отдельные PNG (Claude умеет скриптом)
- [ ] Ресайзить все до 128×128 (Claude умеет скриптом)
- [ ] Разложить по папкам: `assets/eggs/`, `assets/coffee/`, `assets/potions/`, `assets/crystals/`
- [ ] Нагенерить спрайты для заказчиков (customer panel)

## Код — в работе

- [x] ELEM_SCALE переведён на 128px базу (`/ 128`)
- [ ] Подключить новые 4 типа корзинок в `BASKET_CONFIGS` (вместо ring/book)
- [ ] Локализация: определять язык через `navigator.language`, ru → русский, иначе английский
- [ ] Уменьшить long-press корзинки с 200ms до 100ms

## Геймплей

- [ ] Customer / order system — уже есть базовая реализация, доработать под новые типы
- [ ] Animation polish — particle burst on merge, arc travel when fulfilling orders

## Деплой

- [ ] Bump версии в `version.js` перед каждым релизом
