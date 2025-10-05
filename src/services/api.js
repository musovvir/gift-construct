import axios from 'axios';

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '/api/proxy?url=' + encodeURIComponent('https://api.changes.tg');

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

const productionApi = axios.create({
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getCachedData = async (key, fetcher) => {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
};

export const apiService = {
  async getGifts() {
    return getCachedData('gifts', async () => {
      const response = await api.get('/gifts');
      return response.data;
    });
  },

  async getBackdrops() {
    return getCachedData('backdrops', async () => {
      const response = await api.get('/backdrops?sort=asc');
      return response.data;
    });
  },

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

  async getBackdropsForGift(giftName) {
    return getCachedData(`backdrops-${giftName}`, async () => {
      const response = await api.get(`/backdrops/${encodeURIComponent(giftName)}`);
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
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
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
    });
  },

  async getPatternsForGift(giftName) {
    return getCachedData(`patterns-${giftName}`, async () => {
      const response = await api.get(`/patterns/${encodeURIComponent(giftName)}`);
      return Array.isArray(response.data) 
        ? response.data.map(item => typeof item === 'string' ? item : item.name || item)
        : response.data;
    });
  },

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

  async getPatternImage(giftName, patternName) {
    return getCachedData(`pattern-image-${giftName}-${patternName}`, async () => {
      if (process.env.NODE_ENV === 'development') {
        const response = await api.get(`/cdn/gifts/patterns/${encodeURIComponent(giftName)}/png/${encodeURIComponent(patternName)}.png`, { responseType: 'blob' });
        return URL.createObjectURL(response.data);
      } else {
        const response = await productionApi.get('/api/proxy?url=' + encodeURIComponent(`https://cdn.changes.tg/gifts/patterns/${encodeURIComponent(giftName)}/png/${encodeURIComponent(patternName)}.png`), { responseType: 'blob' });
        return URL.createObjectURL(response.data);
      }
    });
  },

  async preloadAllData() {
    const [gifts, backdrops, idToName, radarJson] = await Promise.all([
      apiService.getGifts(),
      apiService.getBackdrops(),
      apiService.getIdToName(),
      apiService.getRadarJson()
    ]);

    return { gifts, backdrops, idToName, radarJson };
  },

  clearCache() {
    cache.clear();
  }
};

export default api;
