import { api } from './client';

export interface FoodSearchResult {
  id: string;
  normalizedName: string;
  servings: Array<{ id: string; label: string; gramsPerUnit: number; isDefault: boolean }>;
  nutrients: {
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  } | null;
}

export interface FoodsResponse {
  data: FoodSearchResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateMealLogItem {
  foodId: string;
  servingId: string;
  quantity: number;
}

export interface CreateMealLogPayload {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  source?: 'text' | 'quick_add' | 'barcode' | 'voice' | 'photo' | 'telegram';
  loggedAt?: string;
  note?: string;
  items: CreateMealLogItem[];
}

export interface QuickAddPayload {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  loggedAt?: string;
  note?: string;
  calories: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  source?: string;
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
    nutrients: {
      caloriesPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
    } | null;
  };
}

export interface SubmitBarcodePayload {
  code: string;
  normalizedName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
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
      `/foods?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    ),

  getFood: (id: string) =>
    api.get<{ data: FoodSearchResult }>(`/foods/${id}`),

  createMealLog: (payload: CreateMealLogPayload) =>
    api.post<{ data: unknown }>('/meal-logs', payload),

  quickAdd: (payload: QuickAddPayload) =>
    api.post<{ data: unknown }>('/meal-logs/quick-add', payload),

  getMealLogs: (date?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (date) params.set('date', date);
    return api.get<{ data: unknown[] }>(`/meal-logs?${params}`);
  },

  barcodeLookup: (code: string) =>
    api.get<{ data: BarcodeLookupResult }>(`/barcodes/${code}`),

  submitBarcode: (payload: SubmitBarcodePayload) =>
    api.post<{ data: { status: string; foodId?: string } }>('/barcodes/submit', payload),

  getFavorites: (limit = 20) =>
    api.get<{ data: FavoriteItem[] }>(`/favorites?limit=${limit}`),

  getRecents: (limit = 20) =>
    api.get<{ data: RecentItem[] }>(`/favorites/recents?limit=${limit}`),

  addFavorite: (foodId: string) =>
    api.post<{ data: unknown }>(`/favorites/${foodId}`),

  removeFavorite: (foodId: string) =>
    api.delete(`/favorites/${foodId}`),
};
