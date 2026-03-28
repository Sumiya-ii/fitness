import { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BackButton } from '../components/ui';
import { useSettingsStore } from '../stores/settings.store';
import { useThemeStore, type ThemeMode } from '../stores/theme.store';
import { api } from '../api';
import { useLocale, type Locale } from '../i18n';
import { useColors } from '../theme';

interface ProfileData {
  locale: string;
  unitSystem: string;
}

function Pill({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  return (
    <View className="flex-row rounded-xl p-[3px] bg-surface-secondary">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            className="px-4 py-1.5 rounded-[10px]"
            style={active ? { backgroundColor: c.muted } : undefined}
          >
            <Text
              className={`text-[13px] font-sans-semibold ${active ? 'text-text' : 'text-text-tertiary'}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-surface-card rounded-2xl px-4 mb-3 border border-surface-border">
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
}

export function AppSettingsScreen() {
  const c = useColors();
  const { locale: currentLocale, setLocale, t } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const currentUnits = useSettingsStore((s) => s.unitSystem);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ data: ProfileData }>('/profile')
        .then((res) => setProfile(res.data))
        .catch(() => {});
    }, []),
  );

  const handleLanguageSelect = async (locale: string) => {
    await setLocale(locale as Locale);
    try {
      await api.put('/profile', { locale });
      setProfile((p) => (p ? { ...p, locale } : p));
    } catch {
      /* keep local */
    }
  };

  const handleUnitsSelect = async (unitSystem: string) => {
    if (unitSystem === 'metric' || unitSystem === 'imperial') {
      await setUnitSystem(unitSystem);
      setProfile((p) => (p ? { ...p, unitSystem } : p));
    }
  };

  const currentLang = profile?.locale ?? currentLocale;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <BackButton />
          <Text className="flex-1 text-lg font-sans-bold text-text text-center mr-10">
            {t('settings.preferences')}
          </Text>
        </View>

        <View className="px-4 pt-6">
          <Section>
            {/* Language */}
            <View className="flex-row items-center py-[14px]">
              <Ionicons
                name="language-outline"
                size={20}
                color={c.textTertiary}
                style={{ width: 28 }}
              />
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.language')}
              </Text>
              <Pill
                options={[
                  { label: 'EN', value: 'en' },
                  { label: 'МН', value: 'mn' },
                ]}
                value={currentLang}
                onChange={handleLanguageSelect}
              />
            </View>
            <Divider />

            {/* Units */}
            <View className="flex-row items-center py-[14px]">
              <Ionicons
                name="resize-outline"
                size={20}
                color={c.textTertiary}
                style={{ width: 28 }}
              />
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.units')}
              </Text>
              <Pill
                options={[
                  { label: t('settings.metric'), value: 'metric' },
                  { label: t('settings.imperial'), value: 'imperial' },
                ]}
                value={currentUnits}
                onChange={handleUnitsSelect}
              />
            </View>
            <Divider />

            {/* Appearance */}
            <View className="flex-row items-center py-[14px]">
              <Ionicons
                name="moon-outline"
                size={20}
                color={c.textTertiary}
                style={{ width: 28 }}
              />
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.appearance')}
              </Text>
              <Pill
                options={[
                  { label: '☀️', value: 'light' },
                  { label: '🌙', value: 'dark' },
                  { label: '⚙️', value: 'system' },
                ]}
                value={themeMode}
                onChange={(v) => setThemeMode(v as ThemeMode)}
              />
            </View>
          </Section>
        </View>
      </SafeAreaView>
    </View>
  );
}
