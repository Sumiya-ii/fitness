import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
  /** 'large' for protein emphasis (FR-031) */
  size?: 'default' | 'large';
  className?: string;
}

export function MacroBar({
  label,
  current,
  target,
  color,
  unit = 'g',
  size = 'default',
  className = '',
}: MacroBarProps) {
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, animatedWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View className={`${className}`}>
      <View className="mb-1.5 flex-row items-baseline justify-between">
        <Text className="text-sm font-sans-medium text-text">
          {label}
        </Text>
        <Text className="text-sm text-text-secondary">
          {current}
          {unit} / {target}
          {unit}
        </Text>
      </View>
      <View
        className={`overflow-hidden rounded-full bg-surface-secondary ${
          size === 'large' ? 'h-3' : 'h-2'
        }`}
      >
        <Animated.View
          style={[
            barStyle,
            {
              height: '100%',
              backgroundColor: color,
              borderRadius: 9999,
            },
          ]}
        />
      </View>
    </View>
  );
}
