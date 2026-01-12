import { useState, useEffect, useMemo } from 'react';
import SearchableSelect from './SearchableSelect';
import { useCopyPaste } from '../contexts/CopyPasteContext';
import {
  useBackdropsForGift,
  useBackdropDetailsForGift,
  useModelsForGift,
  useModelDetailsForGift,
  usePatternsForGift,
  useOriginalLottie
} from '../hooks/useApi';
import { numberToHex } from '../utils/patternUtils.jsx';
import { apiService } from '../services/api';

const cdnUrl = (path) => (import.meta.env.DEV ? `/cdn/${path}` : `https://cdn.changes.tg/${path}`);
const encodeSeg = (s) => encodeURIComponent(String(s ?? ''));
const giftOriginalImageUrlById = (giftId) =>
  cdnUrl(`gifts/originals/${encodeSeg(giftId)}/Original.png`);
const modelImageUrl = (giftName, modelName) =>
  cdnUrl(`gifts/models/${encodeSeg(giftName)}/png/${encodeSeg(modelName)}.png`);
const patternThumbUrl = (giftName, patternName) =>
  cdnUrl(`gifts/patterns/${encodeSeg(giftName)}/png/${encodeSeg(patternName)}.png`);

const rarityPermilleToPercentText = (rarityPermille) => {
  const rp = Number(rarityPermille);
  if (!Number.isFinite(rp) || rp <= 0) return null;
  const percent = rp / 10; // promille -> percent
  const pretty = percent % 1 === 0 ? String(percent.toFixed(0)) : String(percent.toFixed(1));
  return `${pretty}%`;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const compareLabel = (a, b) => collator.compare(String(a?.label ?? ''), String(b?.label ?? ''));
const getRarityValue = (x) => {
  const v = Number(x?.rarityPermille ?? x?.rarity_permille ?? x?.rarity);
  return Number.isFinite(v) ? v : null;
};

const Modal = ({ isOpen, cell, onClose, onApply, onReset, preloadedData, isPreloading }) => {
  const { copyCellData, getCopiedData, hasCopiedData } = useCopyPaste();
  const [formData, setFormData] = useState({
    gift: '',
    model: '',
    backdrop: '',
    pattern: '',
  });
  const [nftLink, setNftLink] = useState('');
  const [nftResolve, setNftResolve] = useState({ status: 'idle', message: '' });
  const isNftResolving = nftResolve.status === 'loading';

  // Получаем список подарков из предзагруженных данных
  const gifts = Array.isArray(preloadedData?.gifts) ? preloadedData.gifts : [];

  // Обновляем formData при открытии модалки
  useEffect(() => {
    if (isOpen) {
      setFormData({
        gift: cell.gift || '',
        model: cell.model || '',
        backdrop: cell.backdrop || '',
        pattern: cell.pattern || '',
      });
      setNftLink('');
      setNftResolve({ status: 'idle', message: '' });
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

  const { data: giftModelDetailsRaw } = useModelDetailsForGift(formData.gift);
  const { data: giftBackdropDetailsRaw } = useBackdropDetailsForGift(formData.gift);

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

  const normalizeKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/gi, '');

  const giftNameToId = useMemo(() => {
    const m = preloadedData?.idToName;
    if (!m || typeof m !== 'object') return {};
    const out = {};
    for (const [id, name] of Object.entries(m)) {
      if (typeof name !== 'string' || !name) continue;
      out[name] = id;
      out[normalizeKey(name)] = id;
    }
    return out;
  }, [preloadedData?.idToName]);

  const giftOptions = useMemo(() => {
    const sorted = [...gifts].sort((a, b) => collator.compare(String(a), String(b)));
    return sorted.map(g => {
      const giftId = giftNameToId[g] || giftNameToId[normalizeKey(g)];
      return {
        value: g,
        label: g,
        imageUrl: giftId ? giftOriginalImageUrlById(giftId) : null,
      };
    });
  }, [gifts, giftNameToId]);

  const modelOptions = useMemo(() => {
    const raw = Array.isArray(giftModelDetailsRaw) ? giftModelDetailsRaw : giftModels;
    const opts = raw
      .map(item => {
        if (typeof item === 'string') {
          return {
            value: item,
            label: item,
            imageUrl: formData.gift ? modelImageUrl(formData.gift, item) : null,
          };
        }
        const name = item?.name ?? item?.label ?? item?.value;
        if (!name) return null;
        return {
          value: name,
          label: name,
          rarityPermille: item?.rarityPermille ?? item?.rarity_permille ?? item?.rarity,
          imageUrl: formData.gift ? modelImageUrl(formData.gift, name) : null,
        };
      })
      .filter(Boolean);

    // Модели: более редкие сначала. Если редкости нет — в конец. При равенстве — по алфавиту.
    return [...opts].sort((a, b) => {
      const ra = getRarityValue(a);
      const rb = getRarityValue(b);
      if (ra == null && rb == null) return compareLabel(a, b);
      if (ra == null) return 1;
      if (rb == null) return -1;
      if (ra !== rb) return ra - rb; // меньше % => более редкая
      return compareLabel(a, b);
    });
  }, [giftModelDetailsRaw, giftModels, formData.gift]);

  const backdropOptions = useMemo(() => {
    const details = Array.isArray(giftBackdropDetailsRaw) ? giftBackdropDetailsRaw : [];
    // fallback на "плоский" список если деталей нет
    if (details.length === 0) {
      const flat = giftBackdrops.map(name => ({ value: name, label: name }));
      // если нет деталей — сортируем хотя бы по алфавиту
      return [...flat].sort(compareLabel);
    }
    const opts = details
      .map(item => {
        const name = item?.name ?? item?.label ?? item?.value;
        if (!name) return null;
        const center = item?.hex?.centerColor ?? (typeof item?.centerColor === 'number' ? numberToHex(item.centerColor) : null);
        const edge = item?.hex?.edgeColor ?? (typeof item?.edgeColor === 'number' ? numberToHex(item.edgeColor) : null);
        return {
          value: name,
          label: name,
          rarityPermille: item?.rarityPermille ?? item?.rarity_permille ?? item?.rarity,
          centerColor: center,
          edgeColor: edge,
        };
      })
      .filter(Boolean);

    // Фоны: по редкости (если приходит), иначе — в конец. При равенстве — по алфавиту.
    return [...opts].sort((a, b) => {
      const ra = getRarityValue(a);
      const rb = getRarityValue(b);
      if (ra == null && rb == null) return compareLabel(a, b);
      if (ra == null) return 1;
      if (rb == null) return -1;
      if (ra !== rb) return ra - rb;
      return compareLabel(a, b);
    });
  }, [giftBackdropDetailsRaw, giftBackdrops]);

  const patternOptions = useMemo(() => {
    const sorted = [...giftPatterns].sort((a, b) => collator.compare(String(a), String(b)));
    return sorted.map(p => ({
      value: p,
      label: p,
      imageUrl: formData.gift ? patternThumbUrl(formData.gift, p) : null,
    }));
  }, [giftPatterns, formData.gift]);

  const resolveGiftNameFromSlug = (slugGiftPart) => {
    if (!slugGiftPart) return null;
    const direct = gifts.find(g => g.toLowerCase() === String(slugGiftPart).toLowerCase());
    if (direct) return direct;

    const map = preloadedData?.idToName;
    if (map && typeof map === 'object') {
      // вариант 1: map[slug] => "Gift Name"
      const v = map[slugGiftPart] || map[String(slugGiftPart).toLowerCase()];
      if (typeof v === 'string' && v) return v;

      // вариант 2: ищем по нормализации в ключах/значениях
      const slugNorm = normalizeKey(slugGiftPart);
      for (const [k, val] of Object.entries(map)) {
        if (normalizeKey(k) === slugNorm && typeof val === 'string') return val;
        if (typeof val === 'string' && normalizeKey(val) === slugNorm) return val;
      }
    }

    const slugNorm = normalizeKey(slugGiftPart);
    return gifts.find(g => normalizeKey(g) === slugNorm) || null;
  };

  const pickName = (x) => {
    if (!x) return null;
    if (typeof x === 'string') return x;
    if (typeof x === 'object') return x.name ?? x.title ?? x.value ?? x.label ?? null;
    return null;
  };

  // Debounced resolve по ссылке t.me/nft/...
  useEffect(() => {
    if (!isOpen) return;

    const raw = String(nftLink || '').trim();
    if (!raw) {
      setNftResolve({ status: 'idle', message: '' });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setNftResolve({ status: 'loading', message: 'Ищу NFT…' });

        // Нормализуем вход: допускаем "t.me/nft/.." и "https://t.me/nft/.."
        const cleaned = raw.replace(/^@/, '');
        const match = cleaned.match(/(?:https?:\/\/)?(?:t\.me\/)?nft\/([^/?#]+)/i);
        if (!match) {
          setNftResolve({ status: 'error', message: 'Неверный формат. Нужно: t.me/nft/GiftName-123' });
          return;
        }

        const slug = match[1].replace(/\/+$/, '');
        const lastDash = slug.lastIndexOf('-');
        if (lastDash <= 0) {
          setNftResolve({ status: 'error', message: 'Неверный формат slug. Нужно: GiftName-123' });
          return;
        }
        const slugGiftPart = slug.slice(0, lastDash);
        const numPart = slug.slice(lastDash + 1);
        if (!/^\d+$/.test(numPart)) {
          setNftResolve({ status: 'error', message: 'Неверный номер NFT. Нужно: GiftName-123' });
          return;
        }

        const giftName = resolveGiftNameFromSlug(slugGiftPart);
        if (giftName) {
          // Минимально: сразу выставим подарок, чтобы подтянулись списки
          setFormData(prev => ({ ...prev, gift: giftName }));
        }

        const data = await apiService.resolveNftBySlug(slug, {
          title: giftName || null,
          model_name: formData.model || null,
          num: Number(numPart),
        });

        // Поддержка формата вида: { gifts: [{ title, slug, num, model_name, backdrop_name, pattern_name, current_owner, ... }] }
        const posoGift = Array.isArray(data?.gifts) && data.gifts.length > 0 ? data.gifts[0] : null;

        const resolvedGift =
          pickName(posoGift?.title) ??
          pickName(posoGift?.gift) ??
          pickName(data?.gift) ??
          pickName(data?.giftName) ??
          pickName(data?.name) ??
          giftName;
        const resolvedModel =
          pickName(posoGift?.model_name) ??
          pickName(posoGift?.model) ??
          pickName(data?.model) ??
          pickName(data?.attributes?.model) ??
          pickName(data?.meta?.model) ??
          null;
        const resolvedBackdrop =
          pickName(posoGift?.backdrop_name) ??
          pickName(posoGift?.backdrop) ??
          pickName(data?.backdrop) ??
          pickName(data?.background) ??
          pickName(data?.attributes?.backdrop) ??
          null;
        const resolvedPattern =
          pickName(posoGift?.pattern_name) ??
          pickName(posoGift?.pattern) ??
          pickName(data?.pattern) ??
          pickName(data?.attributes?.pattern) ??
          null;

        const next = {
          gift: resolvedGift || '',
          model: resolvedModel || '',
          backdrop: resolvedBackdrop || '',
          pattern: resolvedPattern || '',
        };

        // Если ничего не удалось извлечь — сообщим, но не ломаем UI
        if (!next.gift || (!next.model && !next.backdrop && !next.pattern)) {
          setNftResolve({
            status: 'error',
            message:
              'Не удалось автоматически распознать атрибуты из API. Подарок выставлен (если распознан), остальное выбери вручную.',
          });
          if (next.gift) {
            setFormData(prev => ({ ...prev, gift: next.gift }));
          }
          return;
        }

        setFormData(next);
        onApply(next);
        setNftResolve({ status: 'success', message: 'Готово — данные подтянуты.' });
      } catch (e) {
        setNftResolve({
          status: 'error',
          message: 'Ошибка запроса. Проверь прокси/сеть или настрой VITE_BACKEND_URL для своего сервера.',
        });
      }
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftLink, isOpen]);

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
          {/* Быстрое заполнение по ссылке */}
          <div className="form-group">
            <label htmlFor="nft-link">Ссылка на NFT</label>
            <input
              id="nft-link"
              type="text"
              className="text-input"
              value={nftLink}
              onChange={(e) => setNftLink(e.target.value)}
              placeholder="t.me/nft/BlingBinky-371"
              autoComplete="off"
            />
            {nftResolve.status !== 'idle' ? (
              <div className={`nft-resolve-hint nft-resolve-hint--${nftResolve.status}`}>
                {nftResolve.message}
              </div>
            ) : null}
          </div>

          {/* Выбор подарка */}
          <div className="form-group">
            <label htmlFor="gift-select">Подарок</label>
            <SearchableSelect
              id="gift-select"
              value={formData.gift}
              onChange={(value) => handleInputChange('gift', value)}
              options={giftOptions}
              placeholder="Выберите подарок"
              searchPlaceholder="Поиск подарков..."
              disabled={isPreloading || isNftResolving}
              isLoading={isPreloading || isNftResolving}
              renderValue={(opt) => (
                <div className="select-option-row">
                  <img
                    className="select-option-icon"
                    src={opt.imageUrl}
                    alt={opt.label}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
              renderOption={(opt) => (
                <div className="select-option-row">
                  <img
                    className="select-option-icon"
                    src={opt.imageUrl}
                    alt={opt.label}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
            />
          </div>

          {/* Выбор модели */}
          <div className="form-group">
            <label htmlFor="model-select">Модель</label>
            <SearchableSelect
              id="model-select"
              value={formData.model}
              onChange={(value) => handleInputChange('model', value)}
              options={modelOptions}
              placeholder={formData.gift ? "Выберите модель" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск моделей..."
              disabled={!formData.gift || isNftResolving}
              isLoading={isNftResolving || (formData.gift && isModelsLoading)}
              renderValue={(opt) => (
                <div className="select-option-row">
                  {opt.imageUrl ? (
                    <img
                      className="select-option-icon"
                      src={opt.imageUrl}
                      alt={opt.label}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                  {rarityPermilleToPercentText(opt.rarityPermille) ? (
                    <span className="select-option-right">
                      ({rarityPermilleToPercentText(opt.rarityPermille)})
                    </span>
                  ) : null}
                </div>
              )}
              renderOption={(opt) => (
                <div className="select-option-row">
                  {opt.imageUrl ? (
                    <img
                      className="select-option-icon"
                      src={opt.imageUrl}
                      alt={opt.label}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                  {rarityPermilleToPercentText(opt.rarityPermille) ? (
                    <span className="select-option-right">
                      ({rarityPermilleToPercentText(opt.rarityPermille)})
                    </span>
                  ) : null}
                </div>
              )}
            />
          </div>

          {/* Выбор фона */}
          <div className="form-group">
            <label htmlFor="backdrop-select">Фон</label>
            <SearchableSelect
              id="backdrop-select"
              value={formData.backdrop}
              onChange={(value) => handleInputChange('backdrop', value)}
              options={backdropOptions}
              placeholder={formData.gift ? "Выберите фон" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск фонов..."
              disabled={!formData.gift || isNftResolving}
              isLoading={isNftResolving || (formData.gift && isBackdropsLoading)}
              renderValue={(opt) => (
                <div className="select-option-row">
                  {opt.centerColor ? (
                    <span
                      className="select-option-swatch"
                      style={{
                        background: opt.edgeColor
                          ? `radial-gradient(circle at center, ${opt.centerColor}, ${opt.edgeColor})`
                          : opt.centerColor,
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
              renderOption={(opt) => (
                <div className="select-option-row">
                  {opt.centerColor ? (
                    <span
                      className="select-option-swatch"
                      style={{
                        background: opt.edgeColor
                          ? `radial-gradient(circle at center, ${opt.centerColor}, ${opt.edgeColor})`
                          : opt.centerColor,
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
            />
          </div>

          {/* Выбор узора */}
          <div className="form-group">
            <label htmlFor="pattern-select">Узор</label>
            <SearchableSelect
              id="pattern-select"
              value={formData.pattern}
              onChange={(value) => handleInputChange('pattern', value)}
              options={patternOptions}
              placeholder={formData.gift ? "Выберите узор" : "Сначала выберите подарок"}
              searchPlaceholder="Поиск узоров..."
              disabled={!formData.gift || isNftResolving}
              isLoading={isNftResolving || (formData.gift && isPatternsLoading)}
              renderValue={(opt) => (
                <div className="select-option-row">
                  {opt.imageUrl ? (
                    <img
                      className="select-option-icon select-option-icon--square"
                      src={opt.imageUrl}
                      alt={opt.label}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
              renderOption={(opt) => (
                <div className="select-option-row">
                  {opt.imageUrl ? (
                    <img
                      className="select-option-icon select-option-icon--square"
                      src={opt.imageUrl}
                      alt={opt.label}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="select-option-label">{opt.label}</span>
                </div>
              )}
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