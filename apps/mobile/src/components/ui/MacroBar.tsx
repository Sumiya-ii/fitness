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
  className?: string;
}

export function MacroBar({
  label,
  current,
  target,
  color,
  unit = 'g',
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
        <Text className="text-sm font-sans-medium text-text dark:text-slate-200">
          {label}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-slate-400">
          {current}
          {unit} / {target}
          {unit}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
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
