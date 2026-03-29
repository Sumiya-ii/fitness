import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme';

interface OnboardingLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  children: React.ReactNode;
}

export function OnboardingLayout({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  children,
}: OnboardingLayoutProps) {
  const c = useColors();
  const progress = step / totalSteps;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Header: back button + progress bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 8,
            gap: 14,
          }}
        >
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
                flexShrink: 0,
              })}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
          ) : (
            <View style={{ width: 40, height: 40 }} />
          )}

          {/* Progress bar */}
          <View style={{ flex: 1, height: 3, backgroundColor: c.border, borderRadius: 2 }}>
            <View
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                backgroundColor: c.primary,
                borderRadius: 2,
              }}
            />
          </View>
        </View>

        {/* Title + subtitle */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: c.text,
              marginBottom: 8,
              lineHeight: 34,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 15,
                color: c.textTertiary,
                lineHeight: 22,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: 24 }}>{children}</View>

        {/* Continue button */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}>
          <Pressable
            onPress={continueDisabled ? undefined : onContinue}
            disabled={continueDisabled}
            style={({ pressed }) => ({
              backgroundColor: continueDisabled ? c.muted : c.primary,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 18,
              opacity: pressed && !continueDisabled ? 0.88 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: continueDisabled ? c.textTertiary : c.onPrimary,
                letterSpacing: 0.2,
              }}
            >
              {continueLabel}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
