import { View, Text, ActivityIndicator } from 'react-native';

export interface LoadingScreenProps {
  className?: string;
}

export function LoadingScreen({ className = '' }: LoadingScreenProps) {
  return (
    <View
      className={`
        flex-1 items-center justify-center bg-surface dark:bg-slate-900
        ${className}
      `}
    >
      <ActivityIndicator size="large" color="#22c55e" />
      <Text className="mt-4 text-lg font-sans-semibold text-text dark:text-slate-100">
        Coach
      </Text>
    </View>
  );
}
