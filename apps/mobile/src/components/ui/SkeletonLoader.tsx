import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

export type SkeletonVariant = 'rect' | 'circle';

export interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  variant?: SkeletonVariant;
  className?: string;
}

export function SkeletonLoader({
  width = '100%',
  height = 24,
  borderRadius = 8,
  variant = 'rect',
  className = '',
}: SkeletonLoaderProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const size = typeof width === 'number' ? width : 40;
  const resolvedWidth = variant === 'circle' ? size : width;
  const resolvedHeight = variant === 'circle' ? size : height;
  const resolvedBorderRadius = variant === 'circle' ? size / 2 : borderRadius;

  const baseStyle: ViewStyle = {
    width: typeof resolvedWidth === 'string' ? (resolvedWidth as `${number}%`) : resolvedWidth,
    height: typeof resolvedHeight === 'string' ? (resolvedHeight as `${number}%`) : resolvedHeight,
    borderRadius: resolvedBorderRadius,
    backgroundColor: '#e2e8f0',
  };

  return (
    <Animated.View
      style={[baseStyle, { opacity }]}
      className={`dark:bg-slate-700 ${className}`}
    />
  );
}
