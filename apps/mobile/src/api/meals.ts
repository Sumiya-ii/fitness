import { api } from './client';
import { isNetworkError, offlineQueue } from '../services/offlineQueue';
import { useSyncStore } from '../stores/sync.store';

export interface FoodNutrients {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  sodiumPer100g: number | null;
  saturatedFatPer100g: number | null;
}

export interface FoodSearchResult {
  id: string;
  normalizedName: string;
  servings: Array<{ id: string; label: string; gramsPerUnit: number; isDefault: boolean }>;
  nutrients: FoodNutrients | null;
}

export interface FoodsResponse {
  data: FoodSearchResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface MealLogItem {
  id: string;
  foodId: string | null;
  quantity: number;
  servingLabel: string;
  gramsPerUnit: number;
  snapshotFoodName: string;
  snapshotCalories: number;
  snapshotProtein: number;
  snapshotCarbs: number;
  snapshotFat: number;
  snapshotFiber: number | null;
  snapshotSugar: number | null;
  snapshotSodium: number | null;
  snapshotSaturatedFat: number | null;
}

export interface MealLog {
  id: string;
  userId: string;
  mealType: string | null;
  source: string;
  loggedAt: string;
  note: string | null;
  totalCalories: number | null;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number | null;
  totalSugar: number | null;
  totalSodium: number | null;
  totalSaturatedFat: number | null;
  items: MealLogItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealLogItemPayload {
  foodId: string;
  servingId: string;
  quantity: number;
}

export interface CreateMealLogPayload {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  source?: 'text' | 'quick_add' | 'barcode' | 'voice' | 'photo' | 'telegram';
  loggedAt?: string;
  note?: string;
  items: CreateMealLogItemPayload[];
}

export interface QuickAddPayload {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  loggedAt?: string;
  note?: string;
  calories: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMg?: number;
  saturatedFatGrams?: number;
  source?: string;
}

export interface UpdateMealLogPayload {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  note?: string | null;
  loggedAt?: string;
}

export interface BarcodeLookupResult {
  code: string;
  food: {
    id: string;
    name: string;
    servings: Array<{
      id: string;
      label: string;
      gramsPerUnit: number;
      isDefault: boolean;
    }>;
    nutrients: FoodNutrients | null;
  };
}

export interface SubmitBarcodePayload {
  code: string;
  normalizedName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  sodiumPer100g?: number;
  saturatedFatPer100g?: number;
  servingLabel: string;
  gramsPerUnit: number;
  labelPhotoUrls?: string[];
}

export interface FavoriteItem {
  id: string;
  foodId: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  servingCount: number;
  favoritedAt: string;
}

export interface RecentItem {
  foodId: string;
  name: string;
  lastCalories: number;
  lastProtein: number;
  lastUsedAt: string;
}

export const mealsApi = {
  searchFoods: (query: string, page = 1, limit = 20) =>
    api.get<FoodsResponse>(
      `/foods?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    ),

  getFood: (id: string) => api.get<{ data: FoodSearchResult }>(`/foods/${id}`),

  createMealLog: async (payload: CreateMealLogPayload): Promise<{ data: MealLog | null }> => {
    try {
      return await api.post<{ data: MealLog }>('/meal-logs', payload);
    } catch (e) {
      if (isNetworkError(e)) {
        offlineQueue.enqueue({ path: '/meal-logs', body: payload });
        useSyncStore.getState().refreshCount();
        return { data: null };
      }
      throw e;
    }
  },

  quickAdd: async (payload: QuickAddPayload): Promise<{ data: MealLog | null }> => {
    try {
      return await api.post<{ data: MealLog }>('/meal-logs/quick-add', payload);
    } catch (e) {
      if (isNetworkError(e)) {
        offlineQueue.enqueue({ path: '/meal-logs/quick-add', body: payload });
        useSyncStore.getState().refreshCount();
        return { data: null };
      }
      throw e;
    }
  },

  updateMealLog: (id: string, payload: UpdateMealLogPayload) =>
    api.patch<{ data: MealLog }>(`/meal-logs/${id}`, payload),

  deleteMealLog: (id: string) => api.delete(`/meal-logs/${id}`),

  getMealLog: (id: string) => api.get<{ data: MealLog }>(`/meal-logs/${id}`),

  getMealLogs: (date?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (date) params.set('date', date);
    return api.get<{
      data: MealLog[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/meal-logs?${params}`);
  },

  barcodeLookup: (code: string) => api.get<{ data: BarcodeLookupResult }>(`/barcodes/${code}`),

  submitBarcode: (payload: SubmitBarcodePayload) =>
    api.post<{ data: { status: string; foodId?: string } }>('/barcodes/submit', payload),

  getFavorites: (limit = 20) => api.get<{ data: FavoriteItem[] }>(`/favorites?limit=${limit}`),

  getRecents: (limit = 20) => api.get<{ data: RecentItem[] }>(`/favorites/recents?limit=${limit}`),

  addFavorite: (foodId: string) => api.post<{ data: unknown }>(`/favorites/${foodId}`),

  removeFavorite: (foodId: string) => api.delete(`/favorites/${foodId}`),
};
