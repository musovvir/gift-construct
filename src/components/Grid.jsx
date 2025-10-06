import GridCell from './GridCell';

const formatRandomRibbonText = () => {
  // Рандомное число от 3_000 до 90_000
  const randomNumber = Math.floor(Math.random() * (90000 - 3000 + 1)) + 3000;

  // Форматируем в стиль "70.444K"
  const formatted = (randomNumber / 1000)
    .toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Редко, но можно добавить немного разнообразия — например "2 из" или "3 из"
  const firstPart = Math.random() < 0.1 ? 2 : Math.random() < 0.05 ? 3 : 1;

  return `${firstPart} из ${formatted}K`;
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
      {/* Кнопки над сеткой */}
      <div className="row-buttons row-buttons-top">
        <button 
          key="add-row-top"
          className="row-btn add-btn"
          onClick={onAddRowTop}
          aria-label="Добавить ряд сверху"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
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
            <path d="M19 13H5v-2h14v2z" />
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
              {row.map((cell, colIndex) => (
                <GridCell
                  key={cell.id}
                  cell={{
                    ...cell,
                    // Добавляем ленту только если есть gift
                    ribbonText: cell.gift ? (cell.ribbonText ?? formatRandomRibbonText()) : undefined,
                  }}
                  onClick={() => onCellClick(rowIndex, colIndex)}
                  preloadedData={preloadedData}
                  animationTrigger={animationTrigger}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Кнопки под сеткой */}
      <div className="row-buttons row-buttons-bottom">
        <button 
          key="add-row-bottom"
          className="row-btn add-btn"
          onClick={onAddRow}
          aria-label="Добавить ряд снизу"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
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
            <path d="M19 13H5v-2h14v2z" />
          </svg>
          Удалить ряд
        </button>
      </div>
    </div>
  );
};

export default Grid;
