import { useState } from 'react';
import Grid from './Grid';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { usePreloadData } from '../hooks/useApi';

const GiftConstructor = ({ telegramWebApp }) => {
  const [grid, setGrid] = useState(() => {
    // Создаем начальную сетку 3x3
    const initialGrid = [];
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let j = 0; j < 3; j++) {
        row.push({
          id: `cell-${i}-${j}`,
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
            useDefaultPattern: cellData.useDefaultPattern || false,
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
            useDefaultPattern: false,
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
        id: `cell-${newRowIndex}-${j}`,
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
  };

  // Добавление нового ряда сверху
  const handleAddRowTop = () => {
    const newRow = [];
    
    for (let j = 0; j < 3; j++) {
      newRow.push({
        id: `cell-0-${j}`,
        row: 0,
        col: j,
        gift: null,
        model: null,
        backdrop: null,
        pattern: null,
        isEmpty: true,
      });
    }

    // Обновляем индексы всех существующих ячеек
    const updatedGrid = grid.map((row, rowIndex) =>
      row.map(cell => ({
        ...cell,
        id: `cell-${rowIndex + 1}-${cell.col}`,
        row: rowIndex + 1,
      }))
    );

    setGrid([newRow, ...updatedGrid]);

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
      />

      {modalOpen && selectedCell && (
        <Modal
          isOpen={modalOpen}
          cell={selectedCell}
          onClose={handleCloseModal}
          onApply={handleApplyChanges}
          onApplyAndClose={handleCloseModalWithApply}
          onReset={handleResetCell}
          preloadedData={preloadedData}
          isPreloading={isLoading}
          previousCell={getPreviousCell()}
        />
      )}
    </div>
  );
};

export default GiftConstructor;