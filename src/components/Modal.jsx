import { useState, useEffect, useMemo } from 'react';
import SearchableSelect from './SearchableSelect';
import { useCopyPaste } from '../contexts/CopyPasteContext';
import {
  useBackdropsForGift,
  useModelsForGift,
  usePatternsForGift,
  useOriginalLottie
} from '../hooks/useApi';

const Modal = ({ isOpen, cell, onClose, onApply, onReset, preloadedData, isPreloading }) => {
  const { copyCellData, getCopiedData, hasCopiedData } = useCopyPaste();
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
    data: giftBackdropsRaw, 
    isLoading: isBackdropsLoading 
  } = useBackdropsForGift(formData.gift);

  const { 
    data: giftModelsRaw, 
    isLoading: isModelsLoading 
  } = useModelsForGift(formData.gift);

  const { 
    data: giftPatternsRaw, 
    isLoading: isPatternsLoading 
  } = usePatternsForGift(formData.gift);

  // Убеждаемся, что данные - это массивы
  const giftBackdrops = useMemo(() => 
    Array.isArray(giftBackdropsRaw) ? giftBackdropsRaw : [], 
    [giftBackdropsRaw]
  );
  const giftModels = useMemo(() => 
    Array.isArray(giftModelsRaw) ? giftModelsRaw : [], 
    [giftModelsRaw]
  );
  const giftPatterns = useMemo(() => 
    Array.isArray(giftPatternsRaw) ? giftPatternsRaw : [], 
    [giftPatternsRaw]
  );

  // Загружаем Original.json при выборе подарка (для будущего использования)
  useOriginalLottie(formData.gift);

  // Автоматически выбираем первый паттерн/узор из списка при загрузке данных
  useEffect(() => {
    // Проверяем, что:
    // 1. Есть выбранный подарок
    // 2. Загрузка завершена
    // 3. Есть паттерны в списке
    // 4. Паттерн еще не выбран или текущий паттерн не в списке
    if (formData.gift && !isPatternsLoading && giftPatterns.length > 0) {
      const currentPatternExists = giftPatterns.includes(formData.pattern);
      if (!formData.pattern || !currentPatternExists) {
        const firstPattern = giftPatterns[0];
        setFormData(prev => {
          const newData = {
            ...prev,
            pattern: firstPattern,
          };
          // Применяем изменения с первым паттерном
          onApply(newData);
          return newData;
        });
      }
    }
  }, [formData.gift, formData.pattern, isPatternsLoading, giftPatterns, onApply]);


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
  }, [formData.gift, formData.model, formData.backdrop, formData.pattern, cell.gift]);
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

  // Обработчик копирования текущей ячейки
  const handleCopy = () => {
    const currentData = {
      gift: formData.gift || '',
      model: formData.model || '',
      backdrop: formData.backdrop || '',
      pattern: formData.pattern || '',
    };
    
    // Копируем только если есть хотя бы подарок
    if (currentData.gift) {
      copyCellData(currentData);
      // Обратная связь (можно добавить уведомление)
      console.log('Ячейка скопирована');
    }
  };

  // Обработчик вставки скопированных данных
  const handlePaste = () => {
    const copiedData = getCopiedData();
    if (!copiedData || !copiedData.gift) {
      return;
    }
    
    // Обновляем formData скопированными данными
    setFormData({
      gift: copiedData.gift || '',
      model: copiedData.model || '',
      backdrop: copiedData.backdrop || '',
      pattern: copiedData.pattern || '',
    });
    
    // Применяем изменения к ячейке
    if (copiedData.gift) {
      onApply({
        gift: copiedData.gift || '',
        model: copiedData.model || '',
        backdrop: copiedData.backdrop || '',
        pattern: copiedData.pattern || '',
      });
    }
  };

  // Закрытие модального окна при клике вне его
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Получаем список подарков из предзагруженных данных
  const gifts = Array.isArray(preloadedData?.gifts) ? preloadedData.gifts : [];

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Настройка ячейки</h2>
          <div className="modal-header-actions">
            <button 
              className="copy-btn"
              onClick={handleCopy}
              aria-label="Скопировать текущую ячейку"
              title="Скопировать текущую ячейку"
              disabled={!formData.gift}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button 
              className="paste-btn"
              onClick={handlePaste}
              aria-label="Вставить скопированную ячейку"
              title="Вставить скопированную ячейку"
              disabled={!hasCopiedData()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </button>
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