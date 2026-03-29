import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../theme';

export interface BackButtonProps {
  /** Custom handler. Defaults to navigation.goBack(). */
  onPress?: () => void;
  /**
   * 'default' — rounded square with card bg (standard screens)
   * 'overlay' — semi-transparent black circle, white icon (camera/dark-bg screens)
   */
  variant?: 'default' | 'overlay';
}

export function BackButton({ onPress, variant = 'default' }: BackButtonProps) {
  const navigation = useNavigation();
  const c = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  if (variant === 'overlay') {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-11 w-11 rounded-full bg-black/50 items-center justify-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={22} color="#ffffff" />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="h-11 w-11 rounded-full bg-surface-default border border-surface-border items-center justify-center active:opacity-70"
    >
      <Ionicons name="chevron-back" size={20} color={c.text} />
    </Pressable>
  );
}
