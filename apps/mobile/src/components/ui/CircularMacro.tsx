import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface CircularMacroProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
}

export function CircularMacro({
  label,
  current,
  target,
  color,
  unit = 'g',
  size = 70,
  strokeWidth = 5,
}: CircularMacroProps) {
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const remaining = Math.max(target - current, 0);
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withSpring(Math.min(Math.max(progress, 0), 1), {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }} className="relative">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.15}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            className="font-sans-bold text-text"
            style={{ fontSize: size * 0.2 }}
          >
            {remaining}
          </Text>
          <Text
            className="text-text-secondary"
            style={{ fontSize: size * 0.12 }}
          >
            {unit}
          </Text>
        </View>
      </View>
      <Text className="mt-1.5 text-xs font-sans-medium text-text-secondary">
        {label}
      </Text>
      <Text className="text-xs text-text-tertiary">
        {current}/{target}{unit}
      </Text>
    </View>
  );
}
