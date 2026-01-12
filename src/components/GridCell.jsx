import { useEffect, useRef, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { 
  useLottieModel, 
  usePatternImage, 
  useBackdropDetailsForGift, 
  useGiftSupplyForGift,
  useOriginalLottie 
} from '../hooks/useApi';
import { 
  createCircularPattern, 
  getDarkerShade, 
  findBackdropColor, 
  findBackdropEdgeColor, 
  numberToHex,
  mixWithWhite
} from '../utils/patternUtils.jsx';

const GridCell = ({ 
  cell, 
  onClick, 
  preloadedData, 
  animationTrigger
}) => {
  const containerRef = useRef(null);
  const lottieRef = useRef(null);
  const lastAnimationTime = useRef(0);

  // === Drag and Drop с @dnd-kit/core ===
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: cell.id,
    disabled: cell.isEmpty, // Отключаем drag для пустых ячеек
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: cell.id,
  });

  // Объединяем refs для draggable и droppable
  const setRefs = useCallback((node) => {
    setDraggableRef(node);
    setDroppableRef(node);
  }, [setDraggableRef, setDroppableRef]);

  // === API-загрузки ===
  const lottieModelResult = useLottieModel(cell.gift, cell.model);
  const originalLottieResult = useOriginalLottie(cell.gift);
  const { data: lottieData, isLoading: isLottieLoading } =
  cell.model ? lottieModelResult : originalLottieResult;

  const { data: patternImageUrl } = usePatternImage(cell.gift, cell.pattern);
  const { data: backdropDetails } = useBackdropDetailsForGift(cell.gift);

  const allBackdropDetails = preloadedData?.backdrops || backdropDetails;

  const normalizeKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/gi, '');

  const formatCompact = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return null;

    // Формат как на скрине: 14.0K / 72.7K / 1.0M (всегда 1 знак после точки для K/M)
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(Math.round(num));
  };

  // === Риббон: "количество данного подарка" ===
  // Берём Quantity (issued/total) с публичной страницы Telegram t.me/nft/... через наш backend.
  const getRibbonText = () => {
    if (!cell.gift) return null;

    // Если ribbonText уже установлен, используем его
    if (cell.ribbonText) return cell.ribbonText;

    const display = formatCompact(supplyIssued) || formatCompact(supplyTotal);
    if (!display) return '1 из ???';

    return `1 из ${display}`;
  };

  const { data: supplyData } = useGiftSupplyForGift(cell.gift);
  const supplyIssued = Number(supplyData?.issued ?? supplyData?.availability_issued);
  const supplyTotal = Number(supplyData?.total ?? supplyData?.availability_total);

  const ribbonText = getRibbonText();

  // === Управление анимацией ===

  // (1) Воспроизведение
  const playAnimation = useCallback(() => {
    const now = Date.now();
    if (now - lastAnimationTime.current < 500) return;

    if (lottieRef.current && lottieRef.current.isPaused !== false) {
      lottieRef.current.play();
      lastAnimationTime.current = now;
    }
  }, []);

  // (2) Создание / пересоздание Lottie
  const createLottieAnimation = useCallback(() => {
    if (lottieData && containerRef.current && window.lottie) {
      // Очистка старой анимации
      if (lottieRef.current) {
        try {
          lottieRef.current.destroy();
        } catch {
          // Игнорируем ошибки
        }
        lottieRef.current = null;
      }

      containerRef.current.innerHTML = '';

      try {
        lottieRef.current = window.lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: lottieData,
        });

        // Гарантируем показ первого кадра до нажатия кнопки Play
        lottieRef.current.goToAndStop(0, true);

        // По завершении возвращаемся на первый кадр
        lottieRef.current.addEventListener('complete', () => {
          if (lottieRef.current) {
            lottieRef.current.goToAndStop(0, true);
          }
        });
      } catch {
        // Ошибка при загрузке анимации, сбрасываем ref
        lottieRef.current = null;
      }
    }
  }, [lottieData]);

  // === Эффекты ===

  // 1. Создаем анимацию при загрузке данных
  useEffect(() => {
    createLottieAnimation();
  }, [createLottieAnimation]);

  // 2. Внешний триггер анимации (только кнопкой Play)
  useEffect(() => {
    if (animationTrigger && lottieRef.current && cell.gift) {
      playAnimation();
    }
  }, [animationTrigger, cell.gift, playAnimation]);

  // 3. Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (lottieRef.current) {
        try {
          lottieRef.current.destroy();
        } catch {
          // Игнорируем ошибки при cleanup
        }
        lottieRef.current = null;
      }
    };
  }, []);

  // === Вычисления цветов ===
  const getBackdropGradientBackground = () => {
    if (cell.backdrop && allBackdropDetails) {
      const centerColor = findBackdropColor(cell.backdrop, allBackdropDetails);
      const edgeColor = findBackdropEdgeColor(cell.backdrop, allBackdropDetails);

      if (centerColor && edgeColor) {
        return `radial-gradient(circle at center, ${centerColor}, ${edgeColor})`;
      }
      if (centerColor) {
        return `radial-gradient(circle at center, ${centerColor}, ${getDarkerShade(centerColor, 0.8)})`;
      }
    }
    return null;
  };

  const backdropGradientBackground = getBackdropGradientBackground();

  const getCellStyles = () => {
    const styles = {};
    if (backdropGradientBackground) {
      styles.background = backdropGradientBackground;
    }
    return styles;
  };

  const getPatternColor = () => {
    if (!cell.backdrop || !allBackdropDetails) return '#000000';
    const backdrop = allBackdropDetails.find(item => item.name === cell.backdrop);
    if (!backdrop) return '#000000';

    // Базовый цвет паттерна: из API, иначе — derived от centerColor
    let baseColor = null;
    if (backdrop.hex?.patternColor) baseColor = backdrop.hex.patternColor;
    else if (backdrop.patternColor) baseColor = numberToHex(backdrop.patternColor);

    if (!baseColor) {
      const backdropColor = findBackdropColor(cell.backdrop, allBackdropDetails);
      if (backdropColor) {
        // Было 0.7 (слишком темно). Делаем мягче.
        baseColor = getDarkerShade(backdropColor, 0.82);
      }
    }

    // Финальный тюнинг: делаем цвет чуть светлее (мягче) всегда
    return mixWithWhite(baseColor || '#000000', 0.28);
  };

  const getRibbonGradientColors = () => {
    const fallback = { start: '#0B4DB3', end: '#06224D' };
    if (!cell.backdrop || !allBackdropDetails) return fallback;

    const centerHex = findBackdropColor(cell.backdrop, allBackdropDetails);
    const edgeHex = findBackdropEdgeColor(cell.backdrop, allBackdropDetails);

    const base = centerHex || edgeHex;
    if (!base) return fallback;

    // Риббон должен отражать выбранный "Фон": делаем читаемый градиент на базе цветов бэкдропа
    const start = getDarkerShade(base, 0.92);
    const end = getDarkerShade(edgeHex || base, 0.62);
    return { start, end };
  };

  const ribbonGradientColors = getRibbonGradientColors();

  // === Стили для drag and drop ===
  const dragStyle = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition: isDragging ? 'none' : undefined,
  } : undefined;

  // === Render ===
  const cellClassName = [
    'grid-cell',
    cell.isEmpty ? 'empty' : 'filled',
    isDragging ? 'dragging' : '',
    isOver ? 'drag-over' : ''
  ].filter(Boolean).join(' ');

  const patternOverlayOpacity = 0.38;

  return (
    <div
      ref={setRefs}
      className={cellClassName}
      data-cell-id={cell.id}
      onClick={onClick}
      style={{ ...getCellStyles(), ...dragStyle }}
      {...listeners}
      {...attributes}
    >
      {/* Паттерн */}
      {cell.pattern && (
        <div className="pattern-container">
          {createCircularPattern(
            cell.gift,
            cell.pattern,
            cell.backdrop,
            getPatternColor(),
            patternImageUrl,
            lottieData,
            false
          )}
          {backdropGradientBackground ? (
            <div
              className="pattern-overlay"
              style={{
                background: backdropGradientBackground,
                opacity: patternOverlayOpacity,
              }}
            />
          ) : null}
        </div>
      )}

      {/* Lottie */}
      {cell.gift && (
        <div className="gift-container">
          {isLottieLoading ? (
            <div className="gift-loading">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div
              key={`lottie-${cell.gift}-${cell.model || 'original'}`}
              ref={containerRef}
              className="lottie-container"
            />
          )}
        </div>
      )}

      {/* Пустая ячейка */}
      {cell.isEmpty && (
        <div className="cell-placeholder">
          <span className="placeholder-icon">+</span>
        </div>
      )}
      {/* Риббон — показывается только если есть ribbonText */}
      {ribbonText && (
        <div className="gift-ribbon">
          <svg
            className="gift-ribbon-bg"
            width="56"
            height="56"
            viewBox="0 0 56 56"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`gift-ribbon-gradient-${cell.id}`} x1="28" y1="1" x2="28" y2="55" gradientUnits="userSpaceOnUse">
                <stop stopColor={ribbonGradientColors.start} />
                <stop offset="1" stopColor={ribbonGradientColors.end} />
              </linearGradient>
            </defs>
            {/* Плашка в верхнем‑правом углу (диагональная плашка с градиентом) */}
            <path 
              d="M52.4851 26.4853L29.5145 3.51472C27.2641 1.26428 24.2119 0 21.0293 0H2.82824C1.04643 0 0.154103 2.15429 1.41403 3.41422L52.5856 54.5858C53.8455 55.8457 55.9998 54.9534 55.9998 53.1716V34.9706C55.9998 31.788 54.7355 28.7357 52.4851 26.4853Z" 
              fill={`url(#gift-ribbon-gradient-${cell.id})`} 
            />
          </svg>
          <div className="gift-ribbon-text">{ribbonText}</div>
        </div>
      )}
    </div>
  );
};

export default GridCell;
