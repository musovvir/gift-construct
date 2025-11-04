import { useState, useRef, useEffect, useCallback } from 'react';
import Grid from './Grid';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { usePreloadData } from '../hooks/useApi';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

// Глобальный счетчик для создания уникальных ID
let cellIdCounter = 0;

const GiftConstructor = ({ telegramWebApp }) => {
  const [grid, setGrid] = useState(() => {
    // Создаем начальную сетку 3x3
    const initialGrid = [];
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let j = 0; j < 3; j++) {
        row.push({
          id: `cell-${++cellIdCounter}`,
          row: i,
          col: j,
          gift: null,
          model: null,
          backdrop: null,
          pattern: null,
          isEmpty: true,
        });
      }
      initialGrid.push(row);
    }
    return initialGrid;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const animationTimeoutRef = useRef(null);

  // Функция для запуска анимации на всех ячейках с throttling
  const triggerGridAnimation = useCallback(() => {
    // Отменяем предыдущий таймер если он есть
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    // Добавляем небольшую задержку и throttling
    animationTimeoutRef.current = setTimeout(() => {
      setAnimationTrigger(prev => prev + 1);
    }, 50);
  }, []);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Предзагружаем данные при запуске приложения
  const { 
    data: preloadedData, 
    isLoading, 
    error: preloadError 
  } = usePreloadData();

  // Обработчик клика на ячейку
  const handleCellClick = (rowIndex, colIndex) => {
    const cell = grid[rowIndex][colIndex];
    setSelectedCell(cell);
    setModalOpen(true);
  };

  // Находим предыдущую ячейку с данными
  const getPreviousCell = () => {
    if (!selectedCell) return null;
    
    const { rowIndex, colIndex } = selectedCell;
    
    // Ищем предыдущую ячейку (слева направо, сверху вниз)
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        // Пропускаем текущую ячейку и пустые ячейки
        if ((r === rowIndex && c === colIndex) || grid[r][c].isEmpty) {
          continue;
        }
        
        // Если ячейка имеет данные, возвращаем её
        if (grid[r][c].gift) {
          return grid[r][c];
        }
      }
    }
    
    return null;
  };

  // Обработчик перестановки ячеек через drag and drop
  const handleCellSwap = useCallback((sourceCellId, targetCellId) => {
    if (!sourceCellId || !targetCellId || sourceCellId === targetCellId) return;

    setGrid(prevGrid => {
      let sourceCell = null;
      let targetCell = null;
      let sourceRowIndex = -1;
      let sourceColIndex = -1;
      let targetRowIndex = -1;
      let targetColIndex = -1;

      // Находим обе ячейки
      for (let r = 0; r < prevGrid.length; r++) {
        for (let c = 0; c < prevGrid[r].length; c++) {
          if (prevGrid[r][c].id === sourceCellId) {
            sourceCell = { ...prevGrid[r][c] };
            sourceRowIndex = r;
            sourceColIndex = c;
          }
          if (prevGrid[r][c].id === targetCellId) {
            targetCell = { ...prevGrid[r][c] };
            targetRowIndex = r;
            targetColIndex = c;
          }
        }
      }

      if (!sourceCell || !targetCell) return prevGrid;

      // Создаем новую сетку с переставленными ячейками
      const newGrid = prevGrid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          if (rowIndex === sourceRowIndex && colIndex === sourceColIndex) {
            // Заменяем исходную ячейку на целевую
            return { ...targetCell };
          }
          if (rowIndex === targetRowIndex && colIndex === targetColIndex) {
            // Заменяем целевую ячейку на исходную
            return { ...sourceCell };
          }
          return cell;
        })
      );

      return newGrid;
    });

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('medium');
    }

    // Запускаем анимацию на всех ячейках
    triggerGridAnimation();
  }, [telegramWebApp, triggerGridAnimation]);

  // Используем хук для drag and drop
  const dragHandlers = useDragAndDrop(handleCellSwap);

  // Обработчик применения изменений в модальном окне (без закрытия)
  const handleApplyChanges = (cellData) => {
    if (!selectedCell) return;

    const newGrid = grid.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (cell.id === selectedCell.id) {
          return {
            ...cell,
            gift: cellData.gift,
            model: cellData.model,
            backdrop: cellData.backdrop,
            pattern: cellData.pattern,
            isEmpty: !cellData.gift, // Ячейка пустая, если нет подарка
          };
        }
        return cell;
      })
    );

    setGrid(newGrid);

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('light');
    }
  };

  // Обработчик закрытия модалки с применением изменений
  const handleCloseModalWithApply = (cellData) => {
    handleApplyChanges(cellData);
    setModalOpen(false);
    setSelectedCell(null);
  };

  // Обработчик сброса ячейки
  const handleResetCell = () => {
    if (!selectedCell) return;

    const newGrid = grid.map((row) =>
      row.map((cell) => {
        if (cell.id === selectedCell.id) {
          return {
            ...cell,
            gift: null,
            model: null,
            backdrop: null,
            pattern: null,
            isEmpty: true,
          };
        }
        return cell;
      })
    );

    setGrid(newGrid);
    setModalOpen(false);
    setSelectedCell(null);

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('medium');
    }
  };

  // Добавление нового ряда снизу
  const handleAddRow = () => {
    const newRowIndex = grid.length;
    const newRow = [];
    
    for (let j = 0; j < 3; j++) {
      newRow.push({
        id: `cell-${++cellIdCounter}`,
        row: newRowIndex,
        col: j,
        gift: null,
        model: null,
        backdrop: null,
        pattern: null,
        isEmpty: true,
      });
    }

    setGrid([...grid, newRow]);

    // Запускаем анимацию на всех ячейках
    triggerGridAnimation();
  };

  // Добавление нового ряда сверху
  const handleAddRowTop = () => {
    const newRow = [];
    
    for (let j = 0; j < 3; j++) {
      newRow.push({
        id: `cell-${++cellIdCounter}`,
        row: 0,
        col: j,
        gift: null,
        model: null,
        backdrop: null,
        pattern: null,
        isEmpty: true,
      });
    }

    // Обновляем индексы всех существующих ячеек (но сохраняем их ID)
    const updatedGrid = grid.map((row, rowIndex) =>
      row.map(cell => ({
        ...cell,
        row: rowIndex + 1,
      }))
    );

    setGrid([newRow, ...updatedGrid]);

    // Запускаем анимацию на всех ячейках
    triggerGridAnimation();

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('medium');
    }
  };

  // Удаление последнего ряда снизу
  const handleRemoveRow = () => {
    if (grid.length <= 3) return; // Минимум 3 строки

    const updatedGrid = grid.slice(0, -1);
    setGrid(updatedGrid);

    // Запускаем анимацию на всех ячейках
    triggerGridAnimation();

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('medium');
    }
  };

  // Удаление первого ряда сверху
  const handleRemoveRowTop = () => {
    if (grid.length <= 3) return; // Минимум 3 строки

    const updatedGrid = grid.slice(1);
    setGrid(updatedGrid);

    // Запускаем анимацию на всех ячейках
    triggerGridAnimation();

    // Обратная связь для Telegram WebApp
    if (telegramWebApp) {
      telegramWebApp.HapticFeedback?.impactOccurred('medium');
    }
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedCell(null);
  };

  // Показываем экран загрузки во время предзагрузки
  if (isLoading) {
    return (
      <div className="gift-constructor">
        <LoadingSpinner 
          message="Идет загрузка..."
          subMessage="Пожалуйста, подождите"
        />
      </div>
    );
  }

  // Показываем ошибку, если не удалось загрузить данные
  if (preloadError) {
    return (
      <div className="gift-constructor">
        <div className="error-state">
          <div className="error-icon">❌</div>
          <h2>Ошибка загрузки</h2>
          <p>Не удалось загрузить данные приложения. Проверьте подключение к интернету.</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gift-constructor">
      <Grid
        grid={grid}
        onCellClick={handleCellClick}
        onAddRow={handleAddRow}
        onAddRowTop={handleAddRowTop}
        onRemoveRow={handleRemoveRow}
        onRemoveRowTop={handleRemoveRowTop}
        preloadedData={preloadedData}
        animationTrigger={animationTrigger}
        dragHandlers={dragHandlers}
      />

      {modalOpen && selectedCell && (
        <Modal
          isOpen={modalOpen}
          cell={selectedCell}
          onClose={handleCloseModal}
          onApply={handleApplyChanges}
          onReset={handleResetCell}
          preloadedData={preloadedData}
          isPreloading={isLoading}
        />
      )}
    </div>
  );
};

export default GiftConstructor;