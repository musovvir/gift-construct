import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';

// Ключи для кэширования запросов
export const queryKeys = {
  gifts: ['gifts'],
  backdrops: ['backdrops'],
  backdropDetails: ['backdrop-details'],
  backdropsByGift: (giftName) => ['backdrops', giftName],
  backdropDetailsForGift: (giftName) => ['backdrop-details', giftName],
  modelsByGift: (giftName) => ['models', giftName],
  patternsByGift: (giftName) => ['patterns', giftName],
  lottieModel: (giftName, modelName) => ['lottie', giftName, modelName],
  patternImage: (giftName, patternName) => ['pattern-image', giftName, patternName],
  preloadData: ['preload-data'],
};

// Хук для получения списка подарков
export const useGifts = () => {
  return useQuery({
    queryKey: queryKeys.gifts,
    queryFn: apiService.getGifts,
    staleTime: 10 * 60 * 1000, // 10 минут
  });
};

// Хук для получения списка фонов
export const useBackdrops = () => {
  return useQuery({
    queryKey: queryKeys.backdrops,
    queryFn: apiService.getBackdrops,
    staleTime: 10 * 60 * 1000, // 10 минут
  });
};

// Хук для получения фонов для конкретного подарка
export const useBackdropsForGift = (giftName) => {
  return useQuery({
    queryKey: queryKeys.backdropsByGift(giftName),
    queryFn: () => apiService.getBackdropsForGift(giftName),
    enabled: !!giftName, // Выполняется только если указан подарок
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

// Хук для получения деталей фонов (с цветами)
export const useBackdropDetails = () => {
  return useQuery({
    queryKey: queryKeys.backdropDetails,
    queryFn: apiService.getBackdropDetails,
    staleTime: 10 * 60 * 1000, // 10 минут
  });
};

// Хук для получения деталей фонов для конкретного подарка (с цветами)
export const useBackdropDetailsForGift = (giftName) => {
  return useQuery({
    queryKey: queryKeys.backdropDetailsForGift(giftName),
    queryFn: () => apiService.getBackdropDetailsForGift(giftName),
    enabled: !!giftName,
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

// Хук для получения моделей для конкретного подарка
export const useModelsForGift = (giftName) => {
  return useQuery({
    queryKey: queryKeys.modelsByGift(giftName),
    queryFn: () => apiService.getModelsForGift(giftName),
    enabled: !!giftName, // Выполняется только если указан подарок
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

// Хук для получения паттернов для конкретного подарка
export const usePatternsForGift = (giftName) => {
  return useQuery({
    queryKey: queryKeys.patternsByGift(giftName),
    queryFn: () => apiService.getPatternsForGift(giftName),
    enabled: !!giftName, // Выполняется только если указан подарок
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

// Хук для получения Lottie анимации
export const useLottieModel = (giftName, modelName) => {
  return useQuery({
    queryKey: queryKeys.lottieModel(giftName, modelName),
    queryFn: () => apiService.getLottieModel(giftName, modelName),
    enabled: !!(giftName && modelName), // Выполняется только если указаны оба параметра
    staleTime: 15 * 60 * 1000, // 15 минут (анимации редко меняются)
  });
};

// Хук для получения Original.json при выборе подарка
export const useOriginalLottie = (giftName) => {
  return useQuery({
    queryKey: ['original-lottie', giftName],
    queryFn: () => apiService.getOriginalLottie(giftName),
    enabled: !!giftName, // Выполняется только если указан подарок
    staleTime: 15 * 60 * 1000, // 15 минут
  });
};

// Хук для получения изображения паттерна
export const usePatternImage = (giftName, patternName) => {
  return useQuery({
    queryKey: queryKeys.patternImage(giftName, patternName),
    queryFn: () => apiService.getPatternImage(giftName, patternName),
    enabled: !!(giftName && patternName), // Выполняется только если указаны оба параметра
    staleTime: 15 * 60 * 1000, // 15 минут
  });
};





// Хук для предзагрузки всех данных
export const usePreloadData = () => {
  return useQuery({
    queryKey: queryKeys.preloadData,
    queryFn: apiService.preloadAllData,
    staleTime: 30 * 60 * 1000, // 30 минут
    cacheTime: 60 * 60 * 1000, // 1 час
  });
};

// Хук для инвалидации кэша (принудительное обновление данных)
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  const invalidateGifts = () => queryClient.invalidateQueries({ queryKey: queryKeys.gifts });
  const invalidateBackdrops = () => queryClient.invalidateQueries({ queryKey: queryKeys.backdrops });
  const invalidateGiftData = (giftName) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.backdropsByGift(giftName) });
    queryClient.invalidateQueries({ queryKey: queryKeys.modelsByGift(giftName) });
    queryClient.invalidateQueries({ queryKey: queryKeys.patternsByGift(giftName) });
  };

  return {
    invalidateGifts,
    invalidateBackdrops,
    invalidateGiftData,
  };
};

// Хук для мутаций (если понадобится в будущем для отправки данных)
export const useCreateGift = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (giftData) => {
      // Здесь будет логика отправки созданного подарка
      return Promise.resolve(giftData);
    },
    onSuccess: () => {
      // Инвалидируем кэш подарков после создания нового
      queryClient.invalidateQueries({ queryKey: queryKeys.gifts });
    },
  });
};