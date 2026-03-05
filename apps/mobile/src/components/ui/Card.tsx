import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface CardProps extends ViewProps {
  pressable?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Card({
  pressable = false,
  onPress,
  children,
  className = '',
  ...props
}: CardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const baseClasses =
    'rounded-2xl bg-slate-900/80 border border-slate-800 p-4';

  if (pressable && onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
        className={`${baseClasses} ${className}`}
        {...(props as object)}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View className={`${baseClasses} ${className}`} {...props}>
      {children}
    </View>
  );
}
