import axios from 'axios';

// Определяем базовый URL для API
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '/api/proxy?url=' + encodeURIComponent('https://api.changes.tg');

// Создаем экземпляр axios с базовой конфигурацией
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Создаем отдельный экземпляр для production (без baseURL)
const productionApi = axios.create({
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});


// Кэш для API запросов
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Функция для получения данных с кэшированием
const getCachedData = async (key, fetcher) => {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const data = await fetcher();
    cache.set(key, { data, timestamp: now });
    return data;
  } catch (error) {
    throw error;
  }
};

// Функции для работы с API
export const apiService = {
  // Получить список всех подарков
  async getGifts() {
    return getCachedData('gifts', async () => {
      const response = await api.get('/gifts');
      return response.data;
    });
  },

  // Получить список всех фонов с сортировкой
  async getBackdrops() {
    return getCachedData('backdrops', async () => {
      const response = await api.get('/backdrops?sort=asc');
      return response.data;
    });
  },

  // Получить id-to-name mapping
  async getIdToName() {
    return getCachedData('id-to-name', async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get('/cdn/gifts/id-to-name.json');
        return response.data;
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent('https://cdn.changes.tg/gifts/id-to-name.json'));
        return response.data;
      }
    });
  },

  // Получить Radar.json для предзагрузки
  async getRadarJson() {
    return getCachedData('radar', async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get('/cdn/gifts/models/Jingle%20Bells/lottie/Radar.json');
        return response.data;
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent('https://cdn.changes.tg/gifts/models/Jingle%20Bells/lottie/Radar.json'));
        return response.data;
      }
    });
  },

  // Получить фоны для конкретного подарка (только названия)
  async getBackdropsForGift(giftName) {
    return getCachedData(`backdrops-${giftName}`, async () => {
      const response = await api.get(`/backdrops/${encodeURIComponent(giftName)}`);
      // Извлекаем только названия из объектов {name, rarityPermille}
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
    });
  },

  // Получить полные данные фонов для конкретного подарка (с цветами)
  async getBackdropDetailsForGift(giftName) {
    return getCachedData(`backdrop-details-${giftName}`, async () => {
      const response = await api.get(`/backdrops/${encodeURIComponent(giftName)}`);
      return response.data;
    });
  },

  // Получить модели для конкретного подарка
  async getModelsForGift(giftName) {
    return getCachedData(`models-${giftName}`, async () => {
      const response = await api.get(`/models/${encodeURIComponent(giftName)}`);
      // Извлекаем только названия из объектов {name, rarityPermille}
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
    });
  },

  // Получить паттерны для конкретного подарка
  async getPatternsForGift(giftName) {
    return getCachedData(`patterns-${giftName}`, async () => {
      const response = await api.get(`/patterns/${encodeURIComponent(giftName)}`);
      // Извлекаем только названия из объектов {name, rarityPermille}
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
    });
  },

  // Получить Lottie анимацию для модели
  async getLottieModel(giftName, modelName) {
    return getCachedData(`lottie-${giftName}-${modelName}`, async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get(`/cdn/gifts/models/${encodeURIComponent(giftName)}/lottie/${encodeURIComponent(modelName)}.json`);
        return response.data;
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/gifts/models/${encodeURIComponent(giftName)}/lottie/${encodeURIComponent(modelName)}.json`));
        return response.data;
      }
    });
  },

  // Получить Original.json для подарка при выборе
  async getOriginalLottie(giftName) {
    return getCachedData(`original-${giftName}`, async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get(`/cdn/gifts/models/${encodeURIComponent(giftName)}/lottie/Original.json`);
        return response.data;
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/gifts/models/${encodeURIComponent(giftName)}/lottie/Original.json`));
        return response.data;
      }
    });
  },

  // Получить изображение паттерна
  async getPatternImage(giftName, patternName) {
    return getCachedData(`pattern-image-${giftName}-${patternName}`, async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get(`/cdn/gifts/patterns/${encodeURIComponent(giftName)}/png/${encodeURIComponent(patternName)}.png`, {
          responseType: 'blob'
        });
        return URL.createObjectURL(response.data);
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/gifts/patterns/${encodeURIComponent(giftName)}/png/${encodeURIComponent(patternName)}.png`), {
          responseType: 'blob'
        });
        return URL.createObjectURL(response.data);
      }
    });
  },





  // Предварительная загрузка данных согласно спецификации
  async preloadAllData() {
    try {
      // Загружаем только базовые данные при запуске
      const [gifts, backdrops, idToName, radarJson] = await Promise.all([
        apiService.getGifts(),
        apiService.getBackdrops(),
        apiService.getIdToName(),
        apiService.getRadarJson()
      ]);


      return {
        gifts,
        backdrops,
        idToName,
        radarJson
      };
    } catch (error) {
      console.error('Error preloading data:', error);
      throw error;
    }
  },

  // Очистить кэш
  clearCache() {
    cache.clear();
  }
};

export default api;