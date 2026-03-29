import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useThemeStore, type ThemeMode } from '../../stores/theme.store';
import { useColors } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type ThemeOption = {
  id: ThemeMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const OPTIONS: ThemeOption[] = [
  {
    id: 'system',
    icon: 'phone-portrait-outline',
    title: 'System Default',
    description: 'Matches your device appearance',
  },
  {
    id: 'light',
    icon: 'sunny-outline',
    title: 'Light',
    description: 'Clean, bright appearance',
  },
  {
    id: 'dark',
    icon: 'moon-outline',
    title: 'Dark',
    description: 'Easy on the eyes, saves battery',
  },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'ThemeSelect'>;

export function ThemeSelectScreen({ navigation }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const c = useColors();

  return (
    <OnboardingLayout
      step={1}
      totalSteps={TOTAL_STEPS}
      title="Choose your look"
      subtitle="You can always change this later in settings"
      onContinue={() => navigation.navigate('GoalSetup')}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: 12 }}>
          {OPTIONS.map((opt) => {
            const selected = mode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setMode(opt.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? c.primary : c.card,
                  borderRadius: 18,
                  paddingVertical: 22,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: selected ? `${c.onPrimary}26` : `${c.text}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={opt.icon} size={22} color={selected ? c.onPrimary : c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: selected ? '700' : '500',
                      color: selected ? c.onPrimary : c.text,
                      marginBottom: 3,
                    }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: selected ? `${c.onPrimary}a6` : c.textTertiary,
                      lineHeight: 18,
                    }}
                  >
                    {opt.description}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={24} color={c.onPrimary} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}
