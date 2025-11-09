# Обновление: Реальные данные редкости вместо случайных чисел

## Что было изменено

Заменены случайные числа на ленточках подарков (типа "1 из 70.444K") на **реальные данные о редкости** из API.

## Источник данных

API endpoint `/backdrops/{giftName}` возвращает массив backdrops с полем `rarityPermille`:

```json
{
  "name": "Hunter Green",
  "centerColor": 9416312,
  "edgeColor": 4948571,
  "rarityPermille": 10,
  "hex": {
    "centerColor": "#8fae78",
    "edgeColor": "#4b825b"
  }
}
```

### Что такое rarityPermille?

**Промилле (‰)** = 1/1000 (аналог процента, но в тысячных долях)

Формула расчета: `1 из X`, где `X = 1000 / rarityPermille`

#### Примеры:
- `rarityPermille: 10` → 10‰ = 1% → **1 из 100**
- `rarityPermille: 15` → 15‰ = 1.5% → **1 из 67**
- `rarityPermille: 20` → 20‰ = 2% → **1 из 50**
- `rarityPermille: 5` → 5‰ = 0.5% → **1 из 200**

## Реализация

### До изменений

```javascript
// Grid.jsx
const formatRandomRibbonText = () => {
  const randomNumber = Math.floor(Math.random() * (90000 - 3000 + 1)) + 3000;
  const formatted = (randomNumber / 1000).toLocaleString('en-US', { ... });
  return `1 из ${formatted}K`;
};
```

### После изменений

```javascript
// GridCell.jsx
const getRibbonText = () => {
  if (!cell.gift || !cell.backdrop) return null;
  
  const currentBackdrop = backdropDetails.find(item => item.name === cell.backdrop);
  
  if (!currentBackdrop?.rarityPermille) {
    return '1 из ???';
  }
  
  const outOf = Math.round(1000 / currentBackdrop.rarityPermille);
  const formattedNumber = outOf.toLocaleString('en-US');
  
  return `1 из ${formattedNumber}`;
};
```

## Файлы изменены

1. **`src/components/GridCell.jsx`**
   - Добавлена функция `getRibbonText()` для вычисления реальной редкости
   - Использует данные из `backdropDetails` (загружается через `useBackdropDetailsForGift`)
   - Автоматически форматирует числа с разделителями тысяч (1,000, 10,000 и т.д.)

2. **`src/components/Grid.jsx`**
   - Удалена функция `formatRandomRibbonText()`
   - Упрощена передача props в `GridCell` (удален расчет ribbonText)

## Преимущества

✅ **Честность** - показываем реальные данные вместо случайных  
✅ **Точность** - данные берутся напрямую из API  
✅ **Актуальность** - редкость обновляется при изменении backdrop  
✅ **Fallback** - показывается "1 из ???" если данные недоступны  

## Примеры отображения

| rarityPermille | Вычисление | Отображается |
|----------------|------------|--------------|
| 10 | 1000/10 = 100 | 1 из 100 |
| 15 | 1000/15 ≈ 67 | 1 из 67 |
| 20 | 1000/20 = 50 | 1 из 50 |
| 5 | 1000/5 = 200 | 1 из 200 |
| 100 | 1000/100 = 10 | 1 из 10 |
| 1 | 1000/1 = 1000 | 1 из 1,000 |

## Проверка

```bash
# Запустить приложение
npm run dev

# Открыть http://localhost:5173
# Добавить подарок с backdrop
# Проверить, что на ленточке показывается "1 из X", где X - реальное число
```

## API запрос для проверки

```bash
# Получить редкость для конкретного подарка
curl https://api.changes.tg/backdrops/Jingle%20Bells

# Пример ответа:
# [
#   { "name": "Hunter Green", "rarityPermille": 10, ... },
#   { "name": "Onyx Black", "rarityPermille": 15, ... }
# ]
```

