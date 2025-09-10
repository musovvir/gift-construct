import { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { 
  useBackdropsForGift, 
  useModelsForGift, 
  usePatternsForGift,
  useOriginalLottie
} from '../hooks/useApi';

const Modal = ({ isOpen, cell, onClose, onApply, onApplyAndClose, onReset, preloadedData, isPreloading, previousCell }) => {
  const [formData, setFormData] = useState({
    gift: '',
    model: '',
    backdrop: '',
    pattern: '',
  });

  // Обновляем formData при открытии модалки
  useEffect(() => {
    if (isOpen) {
      setFormData({
        gift: cell.gift || '',
        model: cell.model || '',
        backdrop: cell.backdrop || '',
        pattern: cell.pattern || '',
      });
    }
  }, [isOpen, cell]);

  // Загружаем данные для выбранного подарка с помощью React Query
  const { 
    data: giftBackdrops = [], 
    isLoading: isBackdropsLoading 
  } = useBackdropsForGift(formData.gift);
  
  const { 
    data: giftModels = [], 
    isLoading: isModelsLoading 
  } = useModelsForGift(formData.gift);
  
  const { 
    data: giftPatterns = [], 
    isLoading: isPatternsLoading 
  } = usePatternsForGift(formData.gift);

  // Загружаем Original.json при выборе подарка
  const { 
    data: originalLottie, 
    isLoading: isOriginalLoading 
  } = useOriginalLottie(formData.gift);


  // Сбрасываем зависимые поля при изменении подарка (только при ручном выборе)
  useEffect(() => {
    if (formData.gift !== cell.gift && formData.gift) {
      // Проверяем, что это не копирование (когда все поля заполнены одновременно)
      const isCopying = formData.model || formData.backdrop || formData.pattern;
      if (!isCopying) {
        setFormData(prev => ({
          ...prev,
          model: '',
          backdrop: '',
          pattern: '',
        }));
      }
    }
  }, [formData.gift, cell.gift]);

  // Обработчик изменения формы - применяем изменения только когда есть модель
  const handleInputChange = (field, value) => {
    const newFormData = {
      ...formData,
      [field]: value,
    };
    
    // Сбрасываем зависимые поля при изменении подарка (только если это не копирование)
    if (field === 'gift' && value !== formData.gift) {
      // Проверяем, что это не копирование - если все поля заполнены, то это копирование
      const isCopying = formData.model && formData.backdrop && formData.pattern;
      if (!isCopying) {
        newFormData.model = '';
        newFormData.backdrop = '';
        newFormData.pattern = '';
      }
    }
    
    setFormData(newFormData);
    
    // Применяем изменения если есть подарок (с Original.json) или модель
    if (newFormData.gift && (newFormData.model || field === 'gift')) {
      onApply(newFormData);
    }
  };

  // Обработчик закрытия модалки - просто закрывает без повторного применения
  const handleApply = () => {
    onClose();
  };

  // Обработчик сброса
  const handleReset = () => {
    setFormData({
      gift: '',
      model: '',
      backdrop: '',
      pattern: '',
    });
    onReset();
  };

  // Обработчик копирования из предыдущей ячейки
  const handleCopyFromPrevious = () => {
    if (!previousCell) return;
    
    const copiedData = {
      gift: previousCell.gift || '',
      model: previousCell.model || '',
      backdrop: previousCell.backdrop || '',
      pattern: previousCell.pattern || '',
    };
    
    // Обновляем formData
    setFormData(copiedData);
    
    // Применяем изменения к ячейке через handleInputChange для корректной обработки
    if (copiedData.model) {
      // Применяем все данные сразу, как если бы пользователь их ввел
      onApply(copiedData);
    }
  };

  // Закрытие модального окна при клике вне его
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Получаем список подарков из предзагруженных данных
  const gifts = preloadedData?.gifts || [];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Настройка ячейки</h2>
          <div className="modal-header-actions">
            {previousCell && (
              <button 
                className="copy-btn"
                onClick={handleCopyFromPrevious}
                aria-label="Скопировать из предыдущей ячейки"
                title="Скопировать из предыдущей ячейки"
              >
                📄
              </button>
            )}
            <button 
              className="close-btn"
              onClick={onClose}
              aria-label="Закрыть"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* Выбор подарка */}
          <div className="form-group">
            <label htmlFor="gift-select">Подарок</label>
            <SearchableSelect
              id="gift-select"
              value={formData.gift}
              onChange={(value) => handleInputChange('gift', value)}
              options={gifts}
              placeholder="Выберите подарок"
              searchPlaceholder="Поиск подарков..."
              disabled={isPreloading}
              isLoading={isPreloading}
            />
          </div>

          {/* Выбор модели */}
          <div className="form-group">
            <label htmlFor="model-select">Модель</label>
            <SearchableSelect
              id="model-select"
              value={formData.model}
              onChange={(value) => handleInputChange('model', value)}
              options={giftModels}
              placeholder={formData.gift ? "Выберите модель" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск моделей..."
              disabled={!formData.gift}
              isLoading={formData.gift && isModelsLoading}
            />
          </div>

          {/* Выбор фона */}
          <div className="form-group">
            <label htmlFor="backdrop-select">Фон</label>
            <SearchableSelect
              id="backdrop-select"
              value={formData.backdrop}
              onChange={(value) => handleInputChange('backdrop', value)}
              options={giftBackdrops}
              placeholder={formData.gift ? "Выберите фон" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск фонов..."
              disabled={!formData.gift}
              isLoading={formData.gift && isBackdropsLoading}
            />
          </div>

          {/* Выбор узора */}
          <div className="form-group">
            <label htmlFor="pattern-select">Узор</label>
            <SearchableSelect
              id="pattern-select"
              value={formData.pattern}
              onChange={(value) => handleInputChange('pattern', value)}
              options={giftPatterns}
              placeholder={formData.gift ? "Выберите узор" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск узоров..."
              disabled={!formData.gift}
              isLoading={formData.gift && isPatternsLoading}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={handleReset}
          >
            Сбросить
          </button>
              <button 
                className="btn btn-primary" 
                onClick={handleApply}
              >
                Закрыть
              </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;