import { View, Text, ActivityIndicator } from 'react-native';

export interface LoadingScreenProps {
  className?: string;
}

export function LoadingScreen({ className = '' }: LoadingScreenProps) {
  return (
    <View
      className={`
        flex-1 items-center justify-center bg-slate-950
        ${className}
      `}
    >
      <ActivityIndicator size="large" color="#22c55e" />
      <Text className="mt-4 text-lg font-sans-semibold text-white">
        Coach
      </Text>
    </View>
  );
}
