import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface PrimaryPillButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'inverse';
  accessibilityLabel?: string;
  testID?: string;
}

export function PrimaryPillButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  accessibilityLabel,
  testID,
}: PrimaryPillButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isInverse = variant === 'inverse';
  const bgClass = disabled
    ? 'bg-surface-muted'
    : isInverse
      ? 'bg-surface-app active:opacity-90'
      : 'bg-primary-500 active:opacity-90';
  const textClass = disabled ? 'text-text-tertiary' : isInverse ? 'text-text' : 'text-on-primary';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={`rounded-full items-center justify-center min-h-[56px] py-[18px] px-6 ${bgClass}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      {loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={isInverse ? undefined : '#FFFFFF'} />
        </View>
      ) : (
        <Text className={`text-[17px] font-sans-bold tracking-wide ${textClass}`}>{label}</Text>
      )}
    </Pressable>
  );
}
