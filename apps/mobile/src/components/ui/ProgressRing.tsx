import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  color?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  label?: string;
  /** Override center text (default: percentage) */
  centerLabel?: string;
  className?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  color = '#22c55e',
  backgroundColor = '#e2e8f0',
  strokeWidth = 10,
  label,
  centerLabel,
  className = '',
}: ProgressRingProps) {
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withSpring(Math.min(Math.max(progress, 0), 1), {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  const percentage = Math.round(progress * 100);
  const centerText = centerLabel ?? `${percentage}%`;

  return (
    <View className={`items-center justify-center ${className}`}>
      <View style={{ width: size, height: size }} className="relative">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="none"
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
          <Text className="text-2xl font-sans-bold text-text dark:text-slate-100">
            {centerText}
          </Text>
        </View>
      </View>
      {label ? (
        <Text className="mt-2 text-sm font-sans-medium text-text-secondary dark:text-slate-400">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
