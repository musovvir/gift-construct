import { useEffect, useRef } from 'react';
import { useLottieModel, usePatternImage, useBackdropDetailsForGift, useOriginalLottie } from '../hooks/useApi';
import { createCircularPattern, hexToRgb, getDarkerShade, findBackdropColor, findBackdropEdgeColor, numberToHex } from '../utils/patternUtils.jsx';

const GridCell = ({ cell, onClick, preloadedData }) => {
  const containerRef = useRef(null);
  const lottieRef = useRef(null);

  // Загружаем Lottie анимацию для модели или Original.json для подарка
  const { 
    data: lottieData,
    isLoading: isLottieLoading 
  } = cell.model 
    ? useLottieModel(cell.gift, cell.model)
    : useOriginalLottie(cell.gift);


  // Загружаем изображение паттерна если выбраны подарок и паттерн
  const { 
    data: patternImageUrl 
  } = usePatternImage(cell.gift, cell.pattern);

  // Загружаем детали фонов для получения цветов
  const { 
    data: backdropDetails 
  } = useBackdropDetailsForGift(cell.gift);

  // Используем предзагруженные данные фонов если доступны
  const allBackdropDetails = preloadedData?.backdrops || backdropDetails;



  // Инициализируем Lottie анимацию
  useEffect(() => {
    if (lottieData && containerRef.current && window.lottie) {
      // Очищаем предыдущую анимацию
      if (lottieRef.current) {
        try {
          lottieRef.current.destroy();
        } catch (error) {
          // Игнорируем ошибки при уничтожении анимации
        }
        lottieRef.current = null;
      }

      // Очищаем контейнер
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Создаем новую анимацию
      try {
        lottieRef.current = window.lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: lottieData,
        });
      } catch (error) {
        // Игнорируем ошибки при создании анимации
        lottieRef.current = null;
      }

      return () => {
        if (lottieRef.current) {
          try {
            lottieRef.current.destroy();
          } catch (error) {
            // Игнорируем ошибки при уничтожении анимации
          }
          lottieRef.current = null;
        }
      };
    }
  }, [lottieData]);

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      if (lottieRef.current) {
        try {
          lottieRef.current.destroy();
        } catch (error) {
          // Игнорируем ошибки при уничтожении анимации
        }
        lottieRef.current = null;
      }
    };
  }, []);

  // Создаем стили для ячейки
  const getCellStyles = () => {
    let styles = {};

    // Если выбран фон, получаем его цвета из API
    if (cell.backdrop && allBackdropDetails) {
      const centerColor = findBackdropColor(cell.backdrop, allBackdropDetails);
      const edgeColor = findBackdropEdgeColor(cell.backdrop, allBackdropDetails);
      
      if (centerColor && edgeColor) {
        // Используем радиальный градиент как на скрине
        styles.background = `radial-gradient(circle at center, ${centerColor}, ${edgeColor})`;
      } else if (centerColor) {
        styles.background = `radial-gradient(circle at center, ${centerColor}, ${getDarkerShade(centerColor, 0.8)})`;
      }
    }

    return styles;
  };

  // Получаем цвет для паттерна на основе фона
  const getPatternColor = () => {
    if (!cell.backdrop || !allBackdropDetails) return '#000000';
    
    const backdrop = allBackdropDetails.find(item => item.name === cell.backdrop);
    if (!backdrop) return '#000000';
    
    // Сначала пробуем hex.patternColor, потом конвертируем patternColor
    if (backdrop.hex?.patternColor) {
      return backdrop.hex.patternColor;
    }
    
    if (backdrop.patternColor) {
      // Используем нашу функцию numberToHex для конвертации
      const hexColor = numberToHex(backdrop.patternColor);
      return hexColor;
    }
    
    // Fallback: используем centerColor с затемнением
    const backdropColor = findBackdropColor(cell.backdrop, backdropDetails);
    if (backdropColor) {
      const darkerColor = getDarkerShade(backdropColor, 0.7);
      return darkerColor;
    }
    
    return '#000000';
  };

  return (
    <div 
      className={`grid-cell ${cell.isEmpty ? 'empty' : 'filled'}`}
      style={getCellStyles()}
      onClick={onClick}
    >
      {/* Контейнер для паттерна */}
      {cell.pattern && (
        <div className="pattern-container">
          {createCircularPattern(
            cell.gift,
            cell.pattern,
            cell.backdrop,
            getPatternColor(),
            patternImageUrl,
            lottieData
          )}
        </div>
      )}

      {/* Контейнер для Lottie анимации */}
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

      {/* Плейсхолдер для пустой ячейки */}
      {cell.isEmpty && (
        <div className="cell-placeholder">
          <span className="placeholder-icon">+</span>
        </div>
      )}
    </div>
  );
};

export default GridCell;
