import axios from 'axios';

// В режиме разработки используем Vite прокси (/api -> https://api.changes.tg)
// В продакшене используем Vercel serverless прокси
const API_BASE = import.meta.env.DEV
  ? '/api'
  : '/api/proxy?url=' + encodeURIComponent('https://api.changes.tg');

// 1. Уменьшаем timeout до 5 секунд
const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000, // Было 10000
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// API для прямых запросов к CDN (если CORS разрешен)
const directCdnApi = axios.create({
  timeout: 5000, // Было 10000
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// API через прокси (fallback)
const productionApi = axios.create({
  timeout: 5000, // Было 10000
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Опциональный собственный бэкенд (будущий Go-сервер)
// Пример: VITE_BACKEND_URL="https://your-domain.com"
const OWN_BACKEND_BASE = import.meta.env.VITE_BACKEND_URL;
const ownApi = OWN_BACKEND_BASE
  ? axios.create({
      baseURL: OWN_BACKEND_BASE,
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  : null;

// DEV-only: сторонний источник для resolve (например poso.see.tg).
// ⚠️ ВАЖНО: Не храните tgauth в продакшен-фронтенде. Используйте свой Go-сервер как прокси.
const POSO_API_BASE = import.meta.env.VITE_POSO_API_BASE;
const POSO_TGAUTH = import.meta.env.VITE_POSO_TGAUTH;
const posoApi =
  import.meta.env.DEV && POSO_API_BASE
    ? axios.create({
        baseURL: POSO_API_BASE,
        timeout: 8000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
    : null;

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// 4. Debounce для предотвращения повторных запросов
const pendingRequests = new Map();

const getCachedData = async (key, fetcher) => {
  const now = Date.now();
  const cached = cache.get(key);

  // Возвращаем закешированные данные
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Если запрос уже выполняется, ждем его результат (debounce)
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Создаем новый запрос
  const requestPromise = fetcher()
    .then(data => {
      cache.set(key, { data, timestamp: now });
      pendingRequests.delete(key);
      return data;
    })
    .catch(error => {
      pendingRequests.delete(key);
      throw error;
    });

  pendingRequests.set(key, requestPromise);
  return requestPromise;
};

// 5. Попытка прямого запроса к CDN с fallback на прокси
const fetchFromCdnWithFallback = async cdnUrl => {
  if (import.meta.env.DEV) {
    // В dev режиме используем Vite прокси (/cdn -> https://cdn.changes.tg)
    const response = await axios.get(`/cdn/${cdnUrl}`);
    return response.data;
  }

  try {
    // Пытаемся запросить напрямую с CDN
    const response = await directCdnApi.get(`https://cdn.changes.tg/${cdnUrl}`);
    return response.data;
  } catch (error) {
    // Если CORS блокирует или другая ошибка - используем прокси
    console.log(`Direct CDN request failed for ${cdnUrl}, falling back to proxy`);
    const response = await productionApi.get(
      '/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/${cdnUrl}`)
    );
    return response.data;
  }
};

const fetchBlobFromCdnWithFallback = async cdnUrl => {
  if (import.meta.env.DEV) {
    // В dev режиме используем Vite прокси (/cdn -> https://cdn.changes.tg)
    const response = await axios.get(`/cdn/${cdnUrl}`, { responseType: 'blob' });
    return response.data;
  }

  try {
    // Пытаемся запросить напрямую с CDN
    const response = await directCdnApi.get(`https://cdn.changes.tg/${cdnUrl}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    // Если CORS блокирует или другая ошибка - используем прокси
    console.log(`Direct CDN blob request failed for ${cdnUrl}, falling back to proxy`);
    const response = await productionApi.get(
      '/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/${cdnUrl}`),
      { responseType: 'blob' }
    );
    return response.data;
  }
};

const fetchTelegramNftHtml = async (slug) => {
  const safeSlug = encodeURIComponent(String(slug ?? '').trim());
  if (!safeSlug) throw new Error('Missing slug');

  if (import.meta.env.DEV) {
    // via Vite proxy (/tg -> https://t.me)
    const response = await axios.get(`/tg/nft/${safeSlug}`, { responseType: 'text' });
    return String(response.data ?? '');
  }

  // in prod use serverless proxy
  const url = `https://t.me/nft/${safeSlug}`;
  const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent(url), {
    responseType: 'text',
  });
  return String(response.data ?? '');
};

export const apiService = {
  async getGifts() {
    return getCachedData('gifts', async () => {
      const response = await api.get('/gifts');
      return Array.isArray(response.data) ? response.data : [];
    });
  },

  async getBackdrops() {
    return getCachedData('backdrops', async () => {
      const response = await api.get('/backdrops?sort=asc');
      return Array.isArray(response.data) ? response.data : [];
    });
  },

  async getIdToName() {
    return getCachedData('id-to-name', async () => {
      return fetchFromCdnWithFallback('gifts/id-to-name.json');
    });
  },

  async getRadarJson() {
    return getCachedData('radar', async () => {
      return fetchFromCdnWithFallback('gifts/models/Jingle%20Bells/lottie/Radar.json');
    });
  },

  async getBackdropsForGift(giftName) {
    return getCachedData(`backdrops-${giftName}`, async () => {
      const response = await api.get(`/backdrops/${encodeURIComponent(giftName)}`);
      if (!Array.isArray(response.data)) {
        return [];
      }
      return response.data.map(item => (typeof item === 'string' ? item : item.name || item));
    });
  },

  async getBackdropDetailsForGift(giftName) {
    return getCachedData(`backdrop-details-${giftName}`, async () => {
      const response = await api.get(`/backdrops/${encodeURIComponent(giftName)}`);
      return response.data;
    });
  },

  async getModelsForGift(giftName) {
    return getCachedData(`models-${giftName}`, async () => {
      const response = await api.get(`/models/${encodeURIComponent(giftName)}`);
      if (!Array.isArray(response.data)) {
        return [];
      }
      return response.data.map(item => (typeof item === 'string' ? item : item.name || item));
    });
  },

  async getModelDetailsForGift(giftName) {
    return getCachedData(`model-details-${giftName}`, async () => {
      const response = await api.get(`/models/${encodeURIComponent(giftName)}`);
      return Array.isArray(response.data) ? response.data : [];
    });
  },

  async getPatternsForGift(giftName) {
    return getCachedData(`patterns-${giftName}`, async () => {
      const response = await api.get(`/patterns/${encodeURIComponent(giftName)}`);
      if (!Array.isArray(response.data)) {
        return [];
      }
      return response.data.map(item => (typeof item === 'string' ? item : item.name || item));
    });
  },

  async getLottieModel(giftName, modelName) {
    return getCachedData(`lottie-${giftName}-${modelName}`, async () => {
      return fetchFromCdnWithFallback(
        `gifts/models/${encodeURIComponent(giftName)}/lottie/${encodeURIComponent(modelName)}.json`
      );
    });
  },

  async getOriginalLottie(giftName) {
    return getCachedData(`original-${giftName}`, async () => {
      return fetchFromCdnWithFallback(
        `gifts/models/${encodeURIComponent(giftName)}/lottie/Original.json`
      );
    });
  },

  async getPatternImage(giftName, patternName) {
    return getCachedData(`pattern-image-${giftName}-${patternName}`, async () => {
      const blob = await fetchBlobFromCdnWithFallback(
        `gifts/patterns/${encodeURIComponent(giftName)}/png/${encodeURIComponent(patternName)}.png`
      );
      return URL.createObjectURL(blob);
    });
  },

  // Resolve NFT по slug вида "BlingBinky-371".
  // В приоритете — ваш будущий Go сервер: GET {VITE_BACKEND_URL}/v1/nft/resolve?slug=...
  // Fallback — попытки сходить в changes.tg (эндпоинты могут отличаться).
  async resolveNftBySlug(slug, ctx = {}) {
    return getCachedData(`nft-resolve-${slug}`, async () => {
      if (ownApi) {
        const response = await ownApi.get('/v1/nft/resolve', { params: { slug } });
        return response.data;
      }

      // Public Telegram page fallback (no backend): parse HTML from t.me/nft/<slug>
      try {
        const { parseTelegramNftHtml } = await import('../utils/telegramNftParser.js');
        const htmlText = await fetchTelegramNftHtml(slug);
        return parseTelegramNftHtml(htmlText, slug);
      } catch {
        // ignore and try other fallbacks below
      }

      // DEV-only fallback через poso.see.tg (если настроено).
      // ⚠️ По твоим данным обязательны model_name и num, поэтому этот fallback работает
      // только если мы знаем title + model_name + num (например, модель уже выбрана).
      if (posoApi && ctx?.title && ctx?.model_name && ctx?.num != null) {
        try {
          const params = {
            title: ctx.title,
            model_name: ctx.model_name,
            num: ctx.num,
            offset: 0,
            limit: 1,
          };
          if (POSO_TGAUTH) {
            // eslint-disable-next-line no-param-reassign
            params.tgauth = POSO_TGAUTH;
          }

          const response = await posoApi.get('/api/gifts', { params });
          return response.data;
        } catch {
          // игнорируем и идем дальше
        }
      }

      const encoded = encodeURIComponent(slug);
      const candidates = [
        `/nft/${encoded}`,
        `/nfts/${encoded}`,
        `/gift/${encoded}`,
        `/gifts/${encoded}`,
      ];

      let lastError = null;
      for (const path of candidates) {
        try {
          const response = await api.get(path);
          return response.data;
        } catch (e) {
          lastError = e;
        }
      }

      throw lastError || new Error('Failed to resolve NFT');
    });
  },

  async getGiftSupplyForGift(giftName) {
    return getCachedData(`gift-supply-${giftName}`, async () => {
      if (!giftName) return null;
      if (ownApi) {
        const response = await ownApi.get('/v1/gifts/supply', { params: { gift: giftName } });
        return response.data;
      }

      // No backend: probe Telegram pages by trying 1..10 and extracting Quantity
      const slugBase = String(giftName).replace(/[^0-9A-Za-z]+/g, '');
      for (let n = 1; n <= 10; n++) {
        const slug = `${slugBase}-${n}`;
        try {
          const { parseTelegramNftHtml } = await import('../utils/telegramNftParser.js');
          const htmlText = await fetchTelegramNftHtml(slug);
          const parsed = parseTelegramNftHtml(htmlText, slug);
          if (parsed?.availability_total && parsed?.availability_issued) {
            return {
              gift: giftName,
              issued: parsed.availability_issued,
              total: parsed.availability_total,
              availability_issued: parsed.availability_issued,
              availability_total: parsed.availability_total,
            };
          }
        } catch {
          // continue
        }
      }
      return null;
    });
  },

  async preloadAllData() {
    const [gifts, backdrops, idToName, radarJson] = await Promise.all([
      apiService.getGifts(),
      apiService.getBackdrops(),
      apiService.getIdToName(),
      apiService.getRadarJson(),
    ]);

    return { gifts, backdrops, idToName, radarJson };
  },

  clearCache() {
    cache.clear();
  },
};

export default api;
