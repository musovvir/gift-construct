import { useState, useMemo, useRef, useEffect } from 'react';

const SearchableSelect = ({ 
  id,
  value, 
  onChange, 
  options = [], 
  placeholder = "Выберите вариант",
  searchPlaceholder = "Поиск...",
  disabled = false,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const searchInputRef = useRef(null);

  // Фильтруем опции по поисковому запросу
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    
    return options.filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Закрываем селект при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Фокусируемся на поле поиска при открытии
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Обработчик выбора опции
  const handleOptionSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Обработчик очистки выбора
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  // Обработчик переключения открытия/закрытия
  const handleToggle = () => {
    if (disabled || isLoading) return;
    setIsOpen(!isOpen);
  };

  // Находим выбранную опцию для отображения
  const selectedOption = options.find(option => option === value);

  return (
    <div 
      className={`searchable-select ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''} ${isLoading ? 'loading' : ''}`}
      ref={selectRef}
    >
      {/* Поле поиска */}
      {isOpen && (
        <div className="search-container">
          <div className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      {/* Основной селект */}
      <div className="select-display" onClick={handleToggle}>
        <span className={`select-value ${!selectedOption ? 'placeholder' : ''}`}>
          {selectedOption || placeholder}
        </span>
        
        <div className="select-actions">
          {selectedOption && !disabled && (
            <button 
              className="clear-btn"
              onClick={handleClear}
              aria-label="Очистить"
            >
              ×
            </button>
          )}
          {isLoading ? (
            <div className="loading-spinner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="spin">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
              </svg>
            </div>
          ) : (
            <div className={`arrow ${isOpen ? 'up' : 'down'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Выпадающий список */}
      {isOpen && (
        <div className="select-dropdown">
          {filteredOptions.length > 0 ? (
            <div className="options-list">
              {filteredOptions.map((option, index) => (
                <div
                  key={`${option}-${index}`}
                  className={`option ${option === value ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-options">
              Ничего не найдено
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
