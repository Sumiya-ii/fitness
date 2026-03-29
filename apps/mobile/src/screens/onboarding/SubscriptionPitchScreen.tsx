import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SubscriptionPitch'>;

const FEATURE_KEYS = [
  {
    icon: 'camera-outline' as const,
    titleKey: 'onboarding.subPitchPhotoTitle',
    descKey: 'onboarding.subPitchPhotoDesc',
  },
  {
    icon: 'mic-outline' as const,
    titleKey: 'onboarding.subPitchVoiceTitle',
    descKey: 'onboarding.subPitchVoiceDesc',
  },
  {
    icon: 'analytics-outline' as const,
    titleKey: 'onboarding.subPitchAnalyticsTitle',
    descKey: 'onboarding.subPitchAnalyticsDesc',
  },
  {
    icon: 'chatbubbles-outline' as const,
    titleKey: 'onboarding.subPitchChatTitle',
    descKey: 'onboarding.subPitchChatDesc',
  },
  {
    icon: 'infinite-outline' as const,
    titleKey: 'onboarding.subPitchUnlimitedTitle',
    descKey: 'onboarding.subPitchUnlimitedDesc',
  },
] as const;

export function SubscriptionPitchScreen({ navigation }: Props) {
  const c = useColors();
  const { t } = useLocale();

  const handleStartTrial = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('NotificationPermission');
  };

  const handleContinueFree = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('NotificationPermission');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View
          className="pt-10 pb-8 px-6 items-center bg-surface-card"
          style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        >
          {/* Badge */}
          <View
            className="rounded-full px-3.5 py-1.5 mb-5"
            style={{ backgroundColor: `${c.primary}1f` }}
          >
            <Text className="text-xs font-sans-semibold text-text-secondary">
              {t('onboarding.subPitchBadge')}
            </Text>
          </View>

          <Text
            className="text-[30px] font-sans-bold text-text text-center leading-9 mb-2.5"
            accessibilityRole="header"
          >
            {t('onboarding.subPitchTitle')}
          </Text>
          <Text className="text-[15px] text-text-secondary text-center leading-[22px]">
            {t('onboarding.subPitchSubtitle')}
          </Text>

          {/* Price pill */}
          <View
            className="mt-6 rounded-2xl px-5 py-3.5 items-center border"
            style={{
              backgroundColor: `${c.primary}1a`,
              borderColor: `${c.primary}1f`,
            }}
          >
            <Text className="text-xs text-text-tertiary mb-0.5">
              {t('onboarding.subPitchThen')}
            </Text>
            <View className="flex-row items-end gap-1">
              <Text className="text-[11px] font-sans-bold text-text mb-1">{'\u20AE'}</Text>
              <Text className="text-[32px] font-sans-bold text-text">9,900</Text>
              <Text className="text-[13px] text-text-tertiary mb-1.5">
                {t('onboarding.subPitchPerMonth')}
              </Text>
            </View>
            <View className="bg-success rounded-full px-2.5 py-0.5 mt-1.5">
              <Text className="text-white text-[11px] font-sans-bold">
                {t('onboarding.subPitchFreeTrial')}
              </Text>
            </View>
          </View>
        </View>

        {/* Features list */}
        <View className="px-6 pt-7">
          <Text className="text-lg font-sans-bold text-text mb-4">
            {t('onboarding.subPitchFeaturesTitle')}
          </Text>

          <View className="gap-2.5">
            {FEATURE_KEYS.map((f) => (
              <View
                key={f.titleKey}
                className="flex-row items-center bg-surface-card rounded-2xl p-3.5 gap-3"
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${c.primary}1a` }}
                >
                  <Ionicons name={f.icon} size={22} color={c.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-sans-bold text-text mb-0.5">{t(f.titleKey)}</Text>
                  <Text className="text-xs text-text-tertiary leading-[17px]">{t(f.descKey)}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={c.success} />
              </View>
            ))}
          </View>

          {/* Social proof */}
          <View
            className="rounded-2xl p-4 mt-5 border"
            style={{
              backgroundColor: `${c.success}0d`,
              borderColor: `${c.success}26`,
            }}
          >
            <View className="flex-row items-center gap-2 mb-1.5">
              <Text className="text-base">{'\u2B50\u2B50\u2B50\u2B50\u2B50'}</Text>
              <Text className="text-xs font-sans-bold" style={{ color: c.success }}>
                {t('onboarding.subPitchReviewStars')} {'\u00b7'}{' '}
                {t('onboarding.subPitchReviewCount')}
              </Text>
            </View>
            <Text className="text-[13px] leading-[19px] italic" style={{ color: c.textSecondary }}>
              {t('onboarding.subPitchReviewText')}
            </Text>
            <Text
              className="text-[11px] font-sans-semibold mt-1.5"
              style={{ color: c.textTertiary }}
            >
              {t('onboarding.subPitchReviewAuthor')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View className="px-6 pb-10 pt-4 border-t gap-3" style={{ borderTopColor: c.border }}>
        <Pressable
          onPress={handleStartTrial}
          className="bg-primary-500 rounded-full items-center justify-center py-[18px] active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.subPitchStartTrial')}
        >
          <Text className="text-[17px] font-sans-bold text-on-primary">
            {t('onboarding.subPitchStartTrial')}
          </Text>
          <Text className="text-[11px] mt-0.5" style={{ color: `${c.onPrimary}80` }}>
            {t('onboarding.subPitchTrialCancel')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleContinueFree}
          className="items-center py-2.5 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.subPitchContinueFree')}
        >
          <Text className="text-sm text-text-tertiary font-sans-medium">
            {t('onboarding.subPitchContinueFree')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
