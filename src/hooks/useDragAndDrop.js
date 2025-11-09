import { useState, useCallback, useRef } from 'react';

/**
 * Хук для управления drag and drop ячеек в сетке
 * Поддерживает как desktop (drag events), так и mobile (touch events)
 * @param {Function} onDrop - Callback при успешном drop, получает (sourceCellId, targetCellId)
 * @returns {Object} Объект с handlers и состоянием для drag and drop
 */
export const useDragAndDrop = (onDrop) => {
  const [draggedCellId, setDraggedCellId] = useState(null);
  const [dragOverCellId, setDragOverCellId] = useState(null);
  const dragStartTime = useRef(0);
  const touchStartPos = useRef(null);
  const touchCurrentCell = useRef(null);
  const minDragDistance = 10; // Минимальное расстояние для начала drag (px)

  /**
   * Определяет, является ли элемент ячейкой или его потомком
   */
  const findCellElement = (element) => {
    while (element && element !== document.body) {
      if (element.classList && element.classList.contains('grid-cell')) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  };

  /**
   * Получает ID ячейки из элемента
   */
  const getCellIdFromElement = (element) => {
    const cellElement = findCellElement(element);
    if (!cellElement) return null;
    
    // Ищем ближайшую ячейку и получаем её ID из data-атрибута или другого способа
    // Для этого нужно будет добавить data-cell-id в GridCell
    return cellElement.getAttribute('data-cell-id');
  };

  /**
   * Обработчик начала перетаскивания (desktop)
   */
  const handleDragStart = useCallback((e, cellId) => {
    dragStartTime.current = Date.now();
    setDraggedCellId(cellId);
  
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cellId);
  
    // Найдём сам элемент ячейки
    const cellElement = e.currentTarget.closest('.grid-cell');
    if (!cellElement) return;
  
    // Создаём клон для превью
    const clone = cellElement.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = '-1000px';
    clone.style.left = '-1000px';
    clone.style.width = `${cellElement.offsetWidth}px`;
    clone.style.height = `${cellElement.offsetHeight}px`;
    clone.style.transform = 'scale(1)'; // чтобы не уменьшался
    clone.style.opacity = '1';
    clone.style.zIndex = '9999';
    document.body.appendChild(clone);
  
    // Устанавливаем превью
    e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2);
  
    // Удаляем клон после кадра (иначе "следы")
    requestAnimationFrame(() => {
      document.body.removeChild(clone);
    });
  }, []);
  
  
  

  /**
   * Обработчик окончания перетаскивания (desktop)
   */
  const handleDragEnd = useCallback((e) => {
    // Проверяем, что прошло достаточно времени для реального drag
    const dragDuration = Date.now() - dragStartTime.current;
    if (dragDuration < 50) {
      // Слишком быстро - вероятно случайный drag, игнорируем
      setDraggedCellId(null);
      setDragOverCellId(null);
      return;
    }

    setDraggedCellId(null);
    setDragOverCellId(null);
  }, []);

  /**
   * Обработчик входа в зону drop (desktop)
   */
  const handleDragEnter = useCallback((e, cellId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Игнорируем если это та же ячейка
    if (cellId === draggedCellId) return;
    
    setDragOverCellId(cellId);
    e.dataTransfer.dropEffect = 'move';
  }, [draggedCellId]);

  /**
   * Обработчик движения над зоной drop (desktop)
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Обработчик выхода из зоны drop (desktop)
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Проверяем, что мы действительно вышли из элемента, а не вошли в дочерний
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (
      x < rect.left ||
      x > rect.right ||
      y < rect.top ||
      y > rect.bottom
    ) {
      setDragOverCellId(null);
    }
  }, []);

  /**
   * Обработчик drop (desktop)
   */
  const handleDrop = useCallback((e, targetCellId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const sourceCellId = e.dataTransfer.getData('text/plain');
    
    // Игнорируем если это та же ячейка
    if (sourceCellId === targetCellId || !sourceCellId) {
      setDraggedCellId(null);
      setDragOverCellId(null);
      return;
    }

    // Вызываем callback для обработки перестановки
    if (onDrop && typeof onDrop === 'function') {
      onDrop(sourceCellId, targetCellId);
    }

    setDraggedCellId(null);
    setDragOverCellId(null);
  }, [onDrop]);

  // === Touch Events для мобильных устройств ===

  /**
   * Обработчик начала касания (mobile)
   */
  const handleTouchStart = useCallback((e, cellId) => {
    const touch = e.touches[0];
    touchStartPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      cellId: cellId,
      time: Date.now()
    };
    touchCurrentCell.current = cellId;
  }, []);

  /**
   * Обработчик движения касания (mobile)
   */
  const handleTouchMove = useCallback((e) => {
    if (!touchStartPos.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Если прошло достаточно времени и расстояние, начинаем drag
    const timeDelta = Date.now() - touchStartPos.current.time;
    if (distance > minDragDistance && timeDelta > 100) {
      // Предотвращаем скролл только если уже начали drag
      if (draggedCellId || touchStartPos.current.cellId) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Если еще не начали drag, инициализируем его
      if (!draggedCellId && touchStartPos.current.cellId) {
        setDraggedCellId(touchStartPos.current.cellId);
        dragStartTime.current = touchStartPos.current.time;
      }

      // Находим ячейку под касанием только если уже начали drag
      if (draggedCellId) {
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        const cellElement = findCellElement(elementUnderTouch);
        if (cellElement) {
          const cellId = cellElement.getAttribute('data-cell-id');
          if (cellId && cellId !== draggedCellId) {
            setDragOverCellId(cellId);
            touchCurrentCell.current = cellId;
          } else {
            setDragOverCellId(null);
          }
        } else {
          setDragOverCellId(null);
        }
      }
    }
  }, [draggedCellId, minDragDistance]);

  /**
   * Обработчик окончания касания (mobile)
   */
  const handleTouchEnd = useCallback((e) => {
    if (!touchStartPos.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const timeDelta = Date.now() - touchStartPos.current.time;

    const sourceCellId = touchStartPos.current.cellId;
    const targetCellId = touchCurrentCell.current;

    // Если был реальный drag (достаточное расстояние и время)
    if (distance > minDragDistance && timeDelta > 100 && draggedCellId) {
      // Находим финальную ячейку под касанием при отпускании
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      const cellElement = findCellElement(elementUnderTouch);
      const finalTargetCellId = cellElement ? cellElement.getAttribute('data-cell-id') : targetCellId;

      if (finalTargetCellId && sourceCellId !== finalTargetCellId && onDrop && typeof onDrop === 'function') {
        e.preventDefault();
        e.stopPropagation();
        onDrop(sourceCellId, finalTargetCellId);
      }
    }

    // Сбрасываем состояние
    setDraggedCellId(null);
    setDragOverCellId(null);
    touchStartPos.current = null;
    touchCurrentCell.current = null;
  }, [draggedCellId, minDragDistance, onDrop]);

  return {
    draggedCellId,
    dragOverCellId,
    // Desktop handlers
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    // Mobile handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
