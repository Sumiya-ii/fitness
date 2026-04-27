import Animated, { FadeInDown } from 'react-native-reanimated';
import { ReactNode } from 'react';

type Props = { index: number; children: ReactNode };

export function OptionRow({ index, children }: Props) {
  return (
    <Animated.View entering={FadeInDown.delay(60 * index).duration(280)}>{children}</Animated.View>
  );
}
