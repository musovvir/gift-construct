import { useState, useRef, useEffect, useCallback } from 'react';
import Grid from './Grid';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { usePreloadData } from '../hooks/useApi';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// Глобальный счетчик для создания уникальных ID
let cellIdCounter = 0;

// Ключ для сохранения в localStorage
const GRID_STORAGE_KEY = 'giftConstructorGrid';
const COUNTER_STORAGE_KEY = 'giftConstructorCounter';

const GiftConstructor = ({ telegramWebApp }) => {
  const [grid, setGrid] = useState(() => {
    // Пытаемся загрузить сохраненную сетку из localStorage
    try {
      const savedGrid = localStorage.getItem(GRID_STORAGE_KEY);
      const savedCounter = localStorage.getItem(COUNTER_STORAGE_KEY);
      
      if (savedGrid && savedCounter) {
        cellIdCounter = parseInt(savedCounter, 10);
        return JSON.parse(savedGrid);
      }
    } catch (error) {
      console.error('Ошибка загрузки сохраненной сетки:', error);
    }
    
    // Создаем начальную сетку 3x3, если нет сохраненной
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

  // Настраиваем sensors для поддержки мыши и тача
  const mouseSensor = useSensor(MouseSensor, {
    // Минимальная дистанция для начала drag (предотвращает случайные drag при клике)
    activationConstraint: {
      distance: 10,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    // Задержка перед началом drag на мобильных
    activationConstraint: {
      delay: 100,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const [activeDragCell, setActiveDragCell] = useState(null);
  // Обработчик начала перетаскивания
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const cellId = active.id;
    
    // Находим перетаскиваемую ячейку
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c].id === cellId) {
          setActiveDragCell(grid[r][c]);
          break;
        }
      }
    }
  }, [grid]);

  // Обработчик окончания перетаскивания
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveDragCell(null);

    if (!over || active.id === over.id) return;

    const sourceCellId = active.id;
    const targetCellId = over.id;

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

  // Обработчик применения изменений в модальном окне (без закрытия)
  const handleApplyChanges = (cellData) => {
    if (!selectedCell) return;

    const newGrid = grid.map((row) =>
      row.map((cell) => {
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

  // Сохранение сетки в localStorage
  const handleSaveGrid = () => {
    try {
      localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(grid));
      localStorage.setItem(COUNTER_STORAGE_KEY, cellIdCounter.toString());
      
      // Обратная связь для Telegram WebApp
      if (telegramWebApp) {
        telegramWebApp.HapticFeedback?.notificationOccurred('success');
        telegramWebApp.showPopup({
          title: 'Успешно',
          message: 'Сетка сохранена и будет доступна после перезагрузки',
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert('Сетка успешно сохранена!');
      }
    } catch (error) {
      console.error('Ошибка сохранения сетки:', error);
      if (telegramWebApp) {
        telegramWebApp.HapticFeedback?.notificationOccurred('error');
        telegramWebApp.showPopup({
          title: 'Ошибка',
          message: 'Не удалось сохранить сетку',
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert('Ошибка сохранения сетки');
      }
    }
  };

  // Полный сброс сетки
  const handleFullReset = () => {
    const confirmReset = () => {
      // Очищаем localStorage
      try {
        localStorage.removeItem(GRID_STORAGE_KEY);
        localStorage.removeItem(COUNTER_STORAGE_KEY);
      } catch (error) {
        console.error('Ошибка очистки localStorage:', error);
      }

      // Сбрасываем счетчик
      cellIdCounter = 0;
      // Создаем новую начальную сетку 3x3
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

      setGrid(initialGrid);

      // Обратная связь для Telegram WebApp
      if (telegramWebApp) {
        telegramWebApp.HapticFeedback?.notificationOccurred('success');
      }
    };

    // Показываем подтверждение
    if (telegramWebApp) {
      telegramWebApp.showPopup({
        title: 'Подтверждение',
        message: 'Вы уверены, что хотите сбросить всю сетку? Это действие нельзя отменить.',
        buttons: [
          { id: 'cancel', type: 'cancel' },
          { id: 'reset', type: 'destructive', text: 'Сбросить' }
        ]
      }, (buttonId) => {
        if (buttonId === 'reset') {
          confirmReset();
        }
      });
    } else {
      if (window.confirm('Вы уверены, что хотите сбросить всю сетку? Это действие нельзя отменить.')) {
        confirmReset();
      }
    }
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
      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Grid
          grid={grid}
          onCellClick={handleCellClick}
          onAddRow={handleAddRow}
          onAddRowTop={handleAddRowTop}
          onRemoveRow={handleRemoveRow}
          onRemoveRowTop={handleRemoveRowTop}
          onSave={handleSaveGrid}
          onFullReset={handleFullReset}
          preloadedData={preloadedData}
          animationTrigger={animationTrigger}
        />
        
        <DragOverlay>
          {activeDragCell && (
            <div style={{
              width: '100px',
              height: '100px',
              opacity: 0.8,
              cursor: 'grabbing'
            }}>
              {/* Можно добавить превью перетаскиваемой ячейки */}
            </div>
          )}
        </DragOverlay>
      </DndContext>

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