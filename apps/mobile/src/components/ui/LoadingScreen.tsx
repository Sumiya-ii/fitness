import { View, Text, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '../../theme';

export interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message, className = '' }: LoadingScreenProps) {
  const c = useColors();

  return (
    <View
      className={`flex-1 items-center justify-center bg-surface-app ${className}`}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <Animated.View entering={FadeIn.duration(300)} className="items-center">
        <ActivityIndicator size="large" color={c.primary} />
        {message ? (
          <Text className="mt-4 text-base font-sans-medium text-text-secondary">{message}</Text>
        ) : (
          <Text className="mt-4 text-lg font-sans-semibold text-text-app">Coach</Text>
        )}
      </Animated.View>
    </View>
  );
}
