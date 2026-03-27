import { View, Text, ActivityIndicator } from 'react-native';
import { useColors } from '../../theme';

export interface LoadingScreenProps {
  className?: string;
}

export function LoadingScreen({ className = '' }: LoadingScreenProps) {
  const c = useColors();

  return (
    <View
      className={`
        flex-1 items-center justify-center bg-surface-app
        ${className}
      `}
    >
      <ActivityIndicator size="large" color={c.primary} />
      <Text className="mt-4 text-lg font-sans-semibold text-text-app">Coach</Text>
    </View>
  );
}
