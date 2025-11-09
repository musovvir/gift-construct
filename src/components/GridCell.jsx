import { useEffect, useRef, useState, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
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
  animationTrigger
}) => {
  const containerRef = useRef(null);
  const lottieRef = useRef(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [_, setIsHovered] = useState(false);
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

  // === Вычисление ribbonText на основе реальных данных ===
  const getRibbonText = () => {
    if (!cell.gift || !cell.backdrop) return null;
    
    // Если ribbonText уже установлен, используем его
    if (cell.ribbonText) return cell.ribbonText;
    
    // Ищем backdrop details для текущего подарка
    if (!backdropDetails || !Array.isArray(backdropDetails)) return '1 из ???';
    
    const currentBackdrop = backdropDetails.find(item => item.name === cell.backdrop);
    
    if (!currentBackdrop?.rarityPermille || currentBackdrop.rarityPermille <= 0) {
      return '1 из ???';
    }
    
    // rarityPermille = 10 означает 10/1000 = 1%, то есть 1 из 100
    const outOf = Math.round(1000 / currentBackdrop.rarityPermille);
    const formattedNumber = outOf.toLocaleString('en-US');
    
    return `1 из ${formattedNumber}`;
  };

  const ribbonText = getRibbonText();

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
        } catch {
          // Игнорируем ошибки при cleanup
        }
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

  return (
    <div
      ref={setRefs}
      className={cellClassName}
      data-cell-id={cell.id}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
          <div className="gift-ribbon-inner">{ribbonText}</div>
        </div>
      )}
    </div>
  );
};

export default GridCell;
