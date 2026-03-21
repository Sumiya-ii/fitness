import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export interface BackButtonProps {
  /** Custom handler. Defaults to navigation.goBack(). */
  onPress?: () => void;
  /**
   * 'default' — white rounded square, dark icon (light-bg screens)
   * 'overlay' — semi-transparent black circle, white icon (camera/dark-bg screens)
   */
  variant?: 'default' | 'overlay';
}

export function BackButton({ onPress, variant = 'default' }: BackButtonProps) {
  const navigation = useNavigation();

  const handlePress = onPress ?? (() => navigation.goBack());

  if (variant === 'overlay') {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-10 w-10 rounded-full bg-black/50 items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
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
      className="h-10 w-10 rounded-2xl bg-white items-center justify-center"
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        shadowColor: '#0b1220',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      })}
    >
      <Ionicons name="chevron-back" size={22} color="#0b1220" />
    </Pressable>
  );
}
