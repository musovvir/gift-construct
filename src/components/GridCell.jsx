import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  useLottieModel, 
  usePatternImage, 
  useBackdropDetailsForGift, 
  useOriginalLottie 
} from '../hooks/useApi';
import { 
  createCircularPattern, 
  getDarkerShade, 
  findBackdropColor, 
  findBackdropEdgeColor, 
  numberToHex 
} from '../utils/patternUtils.jsx';

const GridCell = ({ 
  cell, 
  onClick, 
  preloadedData, 
  animationTrigger,
  // Drag and drop handlers (desktop)
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  // Touch handlers (mobile)
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  isDragged,
  isDragOver
}) => {
  const containerRef = useRef(null);
  const lottieRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [_, setIsHovered] = useState(false);
  const lastAnimationTime = useRef(0);

  // === API-загрузки ===
  const lottieModelResult = useLottieModel(cell.gift, cell.model);
  const originalLottieResult = useOriginalLottie(cell.gift);
  const { data: lottieData, isLoading: isLottieLoading } =
  cell.model ? lottieModelResult : originalLottieResult;

  const { data: patternImageUrl } = usePatternImage(cell.gift, cell.pattern);
  const { data: backdropDetails } = useBackdropDetailsForGift(cell.gift);

  const allBackdropDetails = preloadedData?.backdrops || backdropDetails;

  // === Управление анимацией ===

  // (1) Воспроизведение
  const playAnimation = useCallback(() => {
    const now = Date.now();
    if (now - lastAnimationTime.current < 500) return;

    if (lottieRef.current && lottieRef.current.isPaused !== false) {
      lottieRef.current.play();
      setHasPlayedOnce(true);
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
        } catch (_) {}
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

        // По завершении возвращаемся на первый кадр
        lottieRef.current.addEventListener('complete', () => {
          if (lottieRef.current) {
            lottieRef.current.goToAndStop(0, true);
          }
        });
      } catch (_) {
        lottieRef.current = null;
      }
    }
  }, [lottieData]);

  // === Эффекты ===

  // 1. Создаем анимацию при загрузке данных
  useEffect(() => {
    createLottieAnimation();
  }, [createLottieAnimation]);

  // 2. Автозапуск один раз при первой загрузке
  useEffect(() => {
    if (lottieRef.current && !hasPlayedOnce) {
      const timer = setTimeout(() => {
        playAnimation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lottieData, hasPlayedOnce, playAnimation]);

  // 3. Внешний триггер анимации
  useEffect(() => {
    if (animationTrigger && lottieRef.current && cell.gift) {
      playAnimation();
    }
  }, [animationTrigger, cell.gift, playAnimation]);

  // 4. Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (lottieRef.current) {
        try {
          lottieRef.current.destroy();
        } catch (_) {}
        lottieRef.current = null;
      }
    };
  }, []);

  // === Hover-эффекты ===
  const handleMouseEnter = () => {
    setIsHovered(true);
    playAnimation();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Не останавливаем сразу — complete сбросит сам
  };

  // === Вычисления цветов ===
  const getCellStyles = () => {
    const styles = {};
    if (cell.backdrop && allBackdropDetails) {
      const centerColor = findBackdropColor(cell.backdrop, allBackdropDetails);
      const edgeColor = findBackdropEdgeColor(cell.backdrop, allBackdropDetails);

      if (centerColor && edgeColor) {
        styles.background = `radial-gradient(circle at center, ${centerColor}, ${edgeColor})`;
      } else if (centerColor) {
        styles.background = `radial-gradient(circle at center, ${centerColor}, ${getDarkerShade(centerColor, 0.8)})`;
      }
    }
    return styles;
  };

  const getPatternColor = () => {
    if (!cell.backdrop || !allBackdropDetails) return '#000000';
    const backdrop = allBackdropDetails.find(item => item.name === cell.backdrop);
    if (!backdrop) return '#000000';

    if (backdrop.hex?.patternColor) return backdrop.hex.patternColor;
    if (backdrop.patternColor) return numberToHex(backdrop.patternColor);

    const backdropColor = findBackdropColor(cell.backdrop, backdropDetails);
    if (backdropColor) return getDarkerShade(backdropColor, 0.7);

    return '#000000';
  };

  // === Drag and Drop handlers ===
  const handleDragStartInternal = (e) => {
    // Разрешаем drag только для заполненных ячеек
    if (cell.isEmpty || !onDragStart) return;
    e.stopPropagation();
    onDragStart(e, cell.id);
  };

  const handleDragEndInternal = (e) => {
    if (!onDragEnd) return;
    e.stopPropagation();
    onDragEnd(e);
  };

  const handleDragEnterInternal = (e) => {
    if (!onDragEnter) return;
    e.stopPropagation();
    onDragEnter(e, cell.id);
  };

  const handleDragOverInternal = (e) => {
    if (!onDragOver) return;
    e.stopPropagation();
    onDragOver(e);
  };

  const handleDragLeaveInternal = (e) => {
    if (!onDragLeave) return;
    e.stopPropagation();
    onDragLeave(e);
  };

  const handleDropInternal = (e) => {
    if (!onDrop) return;
    e.stopPropagation();
    onDrop(e, cell.id);
  };

  // === Render ===
  const cellClassName = [
    'grid-cell',
    cell.isEmpty ? 'empty' : 'filled',
    isDragged ? 'dragging' : '',
    isDragOver ? 'drag-over' : ''
  ].filter(Boolean).join(' ');

  // === Touch handlers (mobile) ===
  const handleTouchStartInternal = (e) => {
    if (cell.isEmpty || !onTouchStart) return;
    e.stopPropagation();
    onTouchStart(e, cell.id);
  };

  const handleTouchMoveInternal = (e) => {
    if (!onTouchMove) return;
    onTouchMove(e);
  };

  const handleTouchEndInternal = (e) => {
    if (!onTouchEnd) return;
    e.stopPropagation();
    onTouchEnd(e);
  };

  return (
    <div
      className={cellClassName}
      data-cell-id={cell.id}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={!cell.isEmpty}
      onDragStart={handleDragStartInternal}
      onDragEnd={handleDragEndInternal}
      onDragEnter={handleDragEnterInternal}
      onDragOver={handleDragOverInternal}
      onDragLeave={handleDragLeaveInternal}
      onDrop={handleDropInternal}
      onTouchStart={handleTouchStartInternal}
      onTouchMove={handleTouchMoveInternal}
      onTouchEnd={handleTouchEndInternal}
      style={getCellStyles()}
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
      {cell.ribbonText && (
        <div className="gift-ribbon">
          <div className="gift-ribbon-inner">{cell.ribbonText}</div>
        </div>
      )}
    </div>
  );
};

export default GridCell;
