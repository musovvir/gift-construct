import GridCell from './GridCell';

const Grid = ({
  grid,
  onCellClick,
  onAddRow,
  onAddRowTop,
  onRemoveRow,
  onRemoveRowTop,
  onSave,
  onFullReset,
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
                  cell={cell}
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

      {/* Кнопки сохранения и сброса */}
      <div className="save-reset-buttons">
        <button 
          className="action-btn save-btn"
          onClick={onSave}
          aria-label="Сохранить сетку"
          title="Сетка сохранится даже после перезагрузки"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Сохранить
        </button>
        <button 
          className="action-btn reset-btn"
          onClick={onFullReset}
          aria-label="Полный сброс"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          Полный сброс
        </button>
      </div>
    </div>
  );
};

export default Grid;