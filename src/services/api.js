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
