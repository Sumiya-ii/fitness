import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  color?: string;
  /** Secondary gradient color for the ring */
  gradientEnd?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  label?: string;
  /** Override center text (default: percentage) */
  centerLabel?: string;
  /** Secondary label shown below center text */
  centerSubLabel?: string;
  /** Tertiary label shown below sub-label */
  centerCaption?: string;
  className?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  color,
  gradientEnd,
  backgroundColor,
  strokeWidth = 10,
  label,
  centerLabel,
  centerSubLabel,
  centerCaption,
  className = '',
}: ProgressRingProps) {
  const c = useColors();
  const resolvedColor = color ?? c.primary;
  const resolvedBg = backgroundColor ?? c.trackBg;
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
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
  const useGradient = !!gradientEnd;

  return (
    <View className={`items-center justify-center ${className}`}>
      <View style={{ width: size, height: size }} className="relative">
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {useGradient && (
            <Defs>
              <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={resolvedColor} />
                <Stop offset="100%" stopColor={gradientEnd} />
              </LinearGradient>
            </Defs>
          )}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={resolvedBg}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.3}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={useGradient ? 'url(#ringGradient)' : resolvedColor}
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
          <Text className="font-sans-bold text-text" style={{ fontSize: size * 0.2 }}>
            {centerText}
          </Text>
          {centerSubLabel ? (
            <Text
              className="font-sans-medium text-text-tertiary"
              style={{ fontSize: size * 0.08, marginTop: 2 }}
            >
              {centerSubLabel}
            </Text>
          ) : null}
          {centerCaption ? (
            <Text
              className="font-sans-medium text-text-tertiary"
              style={{ fontSize: size * 0.07, marginTop: 1 }}
            >
              {centerCaption}
            </Text>
          ) : null}
        </View>
      </View>
      {label ? (
        <Text className="mt-2 text-sm font-sans-medium text-text-secondary">{label}</Text>
      ) : null}
    </View>
  );
}
