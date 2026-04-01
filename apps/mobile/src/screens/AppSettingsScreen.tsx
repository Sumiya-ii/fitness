import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, BottomSheet } from '../components/ui';
import { useThemeStore, type ThemeMode } from '../stores/theme.store';
import { api } from '../api';
import { useLocale, type Locale } from '../i18n';
import { useColors } from '../theme';
import { getDeviceTimezone } from '../utils/timezone';

/**
 * 24 timezone options covering every UTC offset, each identified by a
 * representative city. Sorted west-to-east (UTC-12 → UTC+12).
 */
const TIMEZONE_OPTIONS: { value: string; label: string; offset: string }[] = [
  { value: 'Pacific/Midway', label: 'Midway', offset: 'UTC-11' },
  { value: 'Pacific/Honolulu', label: 'Honolulu', offset: 'UTC-10' },
  { value: 'America/Anchorage', label: 'Anchorage', offset: 'UTC-9' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', offset: 'UTC-8' },
  { value: 'America/Denver', label: 'Denver', offset: 'UTC-7' },
  { value: 'America/Chicago', label: 'Chicago', offset: 'UTC-6' },
  { value: 'America/New_York', label: 'New York', offset: 'UTC-5' },
  { value: 'America/Halifax', label: 'Halifax', offset: 'UTC-4' },
  { value: 'America/Sao_Paulo', label: 'Sao Paulo', offset: 'UTC-3' },
  { value: 'Atlantic/South_Georgia', label: 'South Georgia', offset: 'UTC-2' },
  { value: 'Atlantic/Azores', label: 'Azores', offset: 'UTC-1' },
  { value: 'Europe/London', label: 'London', offset: 'UTC+0' },
  { value: 'Europe/Berlin', label: 'Berlin', offset: 'UTC+1' },
  { value: 'Europe/Helsinki', label: 'Helsinki', offset: 'UTC+2' },
  { value: 'Europe/Moscow', label: 'Moscow', offset: 'UTC+3' },
  { value: 'Asia/Dubai', label: 'Dubai', offset: 'UTC+4' },
  { value: 'Asia/Karachi', label: 'Karachi', offset: 'UTC+5' },
  { value: 'Asia/Dhaka', label: 'Dhaka', offset: 'UTC+6' },
  { value: 'Asia/Bangkok', label: 'Bangkok', offset: 'UTC+7' },
  { value: 'Asia/Shanghai', label: 'Shanghai', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: 'UTC+10' },
  { value: 'Pacific/Noumea', label: 'Noumea', offset: 'UTC+11' },
  { value: 'Pacific/Auckland', label: 'Auckland', offset: 'UTC+12' },
];

interface ProfileData {
  locale: string;
  timezone: string;
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
    <View className="flex-row rounded-xl p-1 bg-surface-secondary">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            className="px-4 py-2 rounded-[10px] min-h-[36px] items-center justify-center"
            style={active ? { backgroundColor: c.card } : undefined}
          >
            <Text
              className="text-sm leading-5 font-sans-semibold"
              style={{ color: active ? c.text : c.textTertiary }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingRow({
  icon,
  label,
  children,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const c = useColors();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} className="flex-row items-center py-3.5 min-h-[52px]">
      <View
        className="h-9 w-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: c.cardAlt }}
      >
        <Ionicons name={icon} size={18} color={c.textTertiary} />
      </View>
      <Text className="flex-1 text-base leading-6 font-sans-medium text-text">{label}</Text>
      {children}
    </Wrapper>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
}

/** Find the display label for a given IANA timezone string. */
function tzDisplayLabel(tz: string): string {
  const match = TIMEZONE_OPTIONS.find((o) => o.value === tz);
  if (match) return `${match.label} (${match.offset})`;
  // Fallback: extract city name from IANA string
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  return city;
}

export function AppSettingsScreen() {
  const { locale: currentLocale, setLocale, t } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const c = useColors();

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

  const handleTimezoneSelect = async (tz: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfile((p) => (p ? { ...p, timezone: tz } : p));
    setTzPickerOpen(false);
    try {
      await api.put('/profile', { timezone: tz });
    } catch {
      /* keep local */
    }
  };

  const currentLang = profile?.locale ?? currentLocale;
  const currentTz = profile?.timezone ?? getDeviceTimezone();

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('settings.preferences')}
          </Text>
        </View>

        <View className="px-5 pt-6">
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
              {/* Language */}
              <SettingRow icon="language-outline" label={t('settings.language')}>
                <Pill
                  options={[
                    { label: 'EN', value: 'en' },
                    { label: 'MN', value: 'mn' },
                  ]}
                  value={currentLang}
                  onChange={handleLanguageSelect}
                />
              </SettingRow>

              <Divider />

              {/* Appearance */}
              <SettingRow icon="moon-outline" label={t('settings.appearance')}>
                <Pill
                  options={[
                    { label: t('onboarding.themeLight'), value: 'light' },
                    { label: t('onboarding.themeDark'), value: 'dark' },
                    { label: t('onboarding.themeSystem').split(' ')[0], value: 'system' },
                  ]}
                  value={themeMode}
                  onChange={(v) => setThemeMode(v as ThemeMode)}
                />
              </SettingRow>

              <Divider />

              {/* Timezone */}
              <SettingRow
                icon="time-outline"
                label={t('settings.timezone')}
                onPress={() => setTzPickerOpen(true)}
              >
                <View className="flex-row items-center">
                  <Text
                    className="text-sm leading-5 font-sans-medium mr-1"
                    style={{ color: c.textSecondary }}
                  >
                    {tzDisplayLabel(currentTz)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
                </View>
              </SettingRow>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Timezone Picker Bottom Sheet */}
      <BottomSheet visible={tzPickerOpen} onClose={() => setTzPickerOpen(false)}>
        <Text className="text-lg leading-7 font-sans-bold text-text mb-4">
          {t('settings.selectTimezone')}
        </Text>
        <FlatList
          data={TIMEZONE_OPTIONS}
          keyExtractor={(item) => item.value}
          style={{ maxHeight: 400 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = item.value === currentTz;
            return (
              <Pressable
                onPress={() => handleTimezoneSelect(item.value)}
                className="flex-row items-center py-3 px-2 rounded-xl"
                style={isSelected ? { backgroundColor: c.cardAlt } : undefined}
              >
                <Text
                  className="flex-1 text-base leading-6 font-sans-medium"
                  style={{ color: isSelected ? c.text : c.textSecondary }}
                >
                  {item.label}
                </Text>
                <Text
                  className="text-sm leading-5 font-sans-regular mr-2"
                  style={{ color: c.textTertiary }}
                >
                  {item.offset}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={c.accent} />}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </View>
  );
}
