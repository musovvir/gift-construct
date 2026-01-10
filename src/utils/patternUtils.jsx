// Утилиты для работы с паттернами и цветами

// Конвертация числа в hex цвет
export const numberToHex = (number) => {
  if (typeof number !== 'number') {
    return null;
  }
  const hex = `#${number.toString(16).padStart(6, '0')}`;
  return hex;
};

// Найти цвет фона по названию
export const findBackdropColor = (backdropName, backdropDetails) => {
  if (!backdropName || !backdropDetails) {
    return null;
  }
  
  const backdrop = backdropDetails.find(item => item.name === backdropName);
  if (!backdrop) {
    return null;
  }
  
  // Сначала пробуем hex.centerColor, потом конвертируем centerColor
  const hexColor = backdrop.hex?.centerColor;
  const numberColor = backdrop.centerColor;
  
  return hexColor || numberToHex(numberColor);
};

// Найти edge цвет фона по названию
export const findBackdropEdgeColor = (backdropName, backdropDetails) => {
  if (!backdropName || !backdropDetails) return null;
  
  const backdrop = backdropDetails.find(item => item.name === backdropName);
  if (!backdrop) return null;
  
  // Сначала пробуем hex.edgeColor, потом конвертируем edgeColor
  const hexColor = backdrop.hex?.edgeColor;
  const numberColor = backdrop.edgeColor;
  
  return hexColor || numberToHex(numberColor);
};

// Конвертация HEX в RGB
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Универсальный парсер CSS-цвета (#RRGGBB или rgb/rgba) -> {r,g,b}
export const parseColorToRgb = (color) => {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim();

  // #RRGGBB / RRGGBB
  const hex = c.startsWith('#') ? c : `#${c}`;
  const hexRgb = hexToRgb(hex);
  if (hexRgb) return hexRgb;

  // rgb(...) / rgba(...)
  const m = c.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (!m) return null;
  const r = Math.min(255, Math.max(0, Number(m[1])));
  const g = Math.min(255, Math.max(0, Number(m[2])));
  const b = Math.min(255, Math.max(0, Number(m[3])));
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
};

// Сделать цвет светлее, подмешивая белый (amount: 0..1)
export const mixWithWhite = (color, amount = 0.25) => {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color;
  const t = Math.min(1, Math.max(0, Number(amount)));
  const r = Math.round(rgb.r + (255 - rgb.r) * t);
  const g = Math.round(rgb.g + (255 - rgb.g) * t);
  const b = Math.round(rgb.b + (255 - rgb.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

// Получение более темного оттенка цвета
export const getDarkerShade = (hexColor, factor = 0.8) => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const r = Math.floor(rgb.r * factor);
  const g = Math.floor(rgb.g * factor);
  const b = Math.floor(rgb.b * factor);

  return `rgb(${r}, ${g}, ${b})`;
};

// Извлечение значения поворота из Lottie данных
export const extractRotationFromLottie = (lottieData) => {
  if (!lottieData || !lottieData.layers || lottieData.layers.length === 0) {
    return 0; // По умолчанию без поворота
  }

  // Ищем поворот во всех слоях
  for (let i = 0; i < lottieData.layers.length; i++) {
    const layer = lottieData.layers[i];
    const rotationData = layer.ks?.r;
    
    if (rotationData) {
      // Простой случай: статический поворот
      if (rotationData.a === 0 && typeof rotationData.k === 'number') {
        return rotationData.k;
      }

      // Анимированный случай: берем первое значение
      if (rotationData.a === 1 && Array.isArray(rotationData.k) && rotationData.k.length > 0) {
        const firstKeyframe = rotationData.k[0];
        if (firstKeyframe.s && Array.isArray(firstKeyframe.s) && firstKeyframe.s.length > 0) {
          return firstKeyframe.s[0];
        }
      }
    }
  }

  return 0; // Fallback
};

// Создание кругового паттерна (React JSX версия)
export const createCircularPattern = (
  gift, 
  pattern, 
  backdrop, 
  patternColor,
  patternImageUrl,
  lottieData = null,
  useDefaultPattern = false
) => {
  if (!pattern) return null;

  // Настройки для концентрических кругов с увеличенным расстоянием
  const rings = [
    { radius: 40, elements: 8, size: 12 },   // Внутреннее кольцо
    { radius: 65, elements: 12, size: 10 },  // Среднее кольцо
    { radius: 90, elements: 16, size: 8 },   // Внешнее кольцо
    { radius: 115, elements: 20, size: 6 }   // Самое внешнее кольцо
  ];

  // Извлекаем поворот из Lottie данных или используем значение по умолчанию
  const rotation = lottieData ? extractRotationFromLottie(lottieData) : -15;
  

  const patternElements = [];

  rings.forEach((ring, ringIndex) => {
    const { radius, elements, size } = ring;
    
    for (let i = 0; i < elements; i++) {
      const angle = (i / elements) * 2 * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      const elementStyle = {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: `${size}px`,
        height: `${size}px`,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        opacity: 0.4, // Увеличиваем прозрачность
        pointerEvents: 'none',
        zIndex: 1,
      };

      if (patternImageUrl && !useDefaultPattern) {
        // Используем изображение паттерна только если не выбран дефолтный узор
        patternElements.push(
          <img
            key={`pattern-${ringIndex}-${i}`}
            src={patternImageUrl}
            alt={pattern}
            style={{
              ...elementStyle,
              width: `${size}px`,
              height: `${size}px`,
              objectFit: 'contain',
              filter: `brightness(0) saturate(100%)`,
              // Применяем цвет паттерна
              WebkitFilter: `brightness(0) saturate(100%) drop-shadow(0 0 0 ${patternColor})`,
            }}
          />
        );
      } else {
        // Используем простую точку (дефолтный узор или fallback)
        patternElements.push(
          <div
            key={`pattern-${useDefaultPattern ? 'default' : 'fallback'}-${ringIndex}-${i}`}
            style={{
              ...elementStyle,
              background: patternColor,
              borderRadius: '50%',
            }}
          />
        );
      }
    }
  });


      // Возвращаем паттерн в контейнере
      return (
        <div 
          style={{
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        >
          {patternElements}
        </div>
      );
};

