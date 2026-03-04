import { GoalType, SupportedLocale, UnitSystem } from './constants';
export interface UserProfile {
    id: string;
    locale: SupportedLocale;
    unitSystem: UnitSystem;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserTarget {
    id: string;
    userId: string;
    goalType: GoalType;
    calorieTarget: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    weeklyRateKg: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
}
export interface ApiResponse<T> {
    data: T;
    meta?: Record<string, unknown>;
}
export interface ApiErrorResponse {
    statusCode: number;
    message: string;
    error: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
//# sourceMappingURL=types.d.ts.map