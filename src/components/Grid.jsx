import GridCell from './GridCell';

// Функция для форматирования числа с разделением тысяч (1 из 33.553)
const formatNumber = (num) => num.toLocaleString('ru-RU');

// Генерация случайного числа в диапазоне (от 3000 до 90000)
const getRandomTotal = () => {
  const num = Math.floor(Math.random() * (90000 - 3000 + 1)) + 3000;
  return formatNumber(num);
};

const Grid = ({
  grid,
  onCellClick,
  onAddRow,
  onAddRowTop,
  onRemoveRow,
  onRemoveRowTop,
  preloadedData,
  animationTrigger
}) => {
  return (
    <div className="grid-container">
      {/* Верхние кнопки */}
      <div className="row-buttons row-buttons-top">
        <button 
          key="add-row-top"
          className="row-btn add-btn"
          onClick={onAddRowTop}
          aria-label="Добавить ряд сверху"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Добавить ряд
        </button>
        <button 
          key="remove-row-top"
          className="row-btn remove-btn"
          onClick={onRemoveRowTop}
          disabled={grid.length <= 3}
          aria-label="Удалить ряд сверху"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
          Удалить ряд
        </button>
      </div>

      {/* Сетка */}
      <div className="grid">
        {grid.map((row, rowIndex) => {
          const rowKey = row.map(cell => cell.id).join('-');

          return (
            <div key={rowKey} className="grid-row">
              {row.map((cell, colIndex) => {
                // Добавляем случайный ribbonText, если его нет
                const ribbonText = cell.ribbonText || `1 из ${getRandomTotal()}`;

                return (
                  <GridCell
                    key={cell.id}
                    cell={{ ...cell, ribbonText }}
                    onClick={() => onCellClick(rowIndex, colIndex)}
                    preloadedData={preloadedData}
                    animationTrigger={animationTrigger}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Нижние кнопки */}
      <div className="row-buttons row-buttons-bottom">
        <button 
          key="add-row-bottom"
          className="row-btn add-btn"
          onClick={onAddRow}
          aria-label="Добавить ряд снизу"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Добавить ряд
        </button>
        <button 
          key="remove-row-bottom"
          className="row-btn remove-btn"
          onClick={onRemoveRow}
          disabled={grid.length <= 3}
          aria-label="Удалить ряд снизу"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
          Удалить ряд
        </button>
      </div>
    </div>
  );
};

export default Grid;
