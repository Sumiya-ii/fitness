import { View, Text, Pressable, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';
import { useLocale } from '../i18n';
import { useColors, darkPalette } from '../theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

function AppPreview() {
  const c = useColors();

  return (
    <Animated.View entering={FadeIn.duration(600).delay(200)} className="items-center">
      <View
        className="rounded-[40px] overflow-hidden"
        style={{ width: 256, height: 480, backgroundColor: c.card }}
      >
        {/* Inner screen */}
        <View
          className="flex-1 rounded-[33px] overflow-hidden"
          style={{ margin: 8, backgroundColor: c.cardAlt }}
        >
          {/* Mock status bar */}
          <View className="h-7 flex-row items-center justify-between px-4 pt-1">
            <Text className="text-[11px] font-sans-bold" style={{ color: c.text }}>
              2:10
            </Text>
            <View className="w-[76px] h-[18px] rounded-[9px]" style={{ backgroundColor: c.text }} />
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="cellular" size={10} color={c.text} />
              <Ionicons name="wifi" size={10} color={c.text} />
              <Ionicons name="battery-full" size={10} color={c.text} />
            </View>
          </View>

          {/* App header */}
          <View className="px-3.5 pt-1.5 pb-2" style={{ backgroundColor: c.cardAlt }}>
            <View className="flex-row items-center mb-2">
              <Ionicons name="sparkles" size={14} color={c.text} />
              <Text className="text-[14px] font-sans-bold ml-1.5" style={{ color: c.text }}>
                Coach
              </Text>
            </View>
            <View className="flex-row gap-2.5">
              <View className="items-center">
                <Text className="text-[11px] font-sans-semibold" style={{ color: c.text }}>
                  Today
                </Text>
                <View className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: c.text }} />
              </View>
              <Text className="text-[11px]" style={{ color: c.textTertiary }}>
                Yesterday
              </Text>
            </View>
          </View>

          {/* Calorie card */}
          <View
            className="mx-2.5 rounded-xl p-2.5 flex-row items-center justify-between mb-2"
            style={{ backgroundColor: c.card }}
          >
            <View>
              <Text className="text-[22px] font-sans-bold" style={{ color: c.text }}>
                2,450
              </Text>
              <Text className="text-[9px] mt-0.5" style={{ color: c.textSecondary }}>
                Calories left
              </Text>
            </View>
            <View
              className="w-[38px] h-[38px] rounded-full items-center justify-center"
              style={{ borderWidth: 2.5, borderColor: c.border }}
            >
              <Ionicons name="flame-outline" size={18} color={c.text} />
            </View>
          </View>

          {/* Camera / food view area */}
          <View className="flex-1 relative" style={{ backgroundColor: c.card }}>
            {/* Gradient-like dark bg for camera area */}
            <View className="flex-1" style={{ backgroundColor: c.bg, opacity: 0.9 }} />

            {/* Corner brackets - top left */}
            <View
              className="absolute top-3 left-3.5 w-5 h-5"
              style={{ borderTopWidth: 2, borderLeftWidth: 2, borderColor: `${c.text}bf` }}
            />
            {/* Top right */}
            <View
              className="absolute top-3 right-3.5 w-5 h-5"
              style={{ borderTopWidth: 2, borderRightWidth: 2, borderColor: `${c.text}bf` }}
            />
            {/* Bottom left */}
            <View
              className="absolute bottom-3 left-3.5 w-5 h-5"
              style={{ borderBottomWidth: 2, borderLeftWidth: 2, borderColor: `${c.text}bf` }}
            />
            {/* Bottom right */}
            <View
              className="absolute bottom-3 right-3.5 w-5 h-5"
              style={{ borderBottomWidth: 2, borderRightWidth: 2, borderColor: `${c.text}bf` }}
            />

            {/* Close button */}
            <View
              className="absolute top-2 left-2 w-[22px] h-[22px] rounded-full items-center justify-center"
              style={{ backgroundColor: `${c.bg}73` }}
            >
              <Ionicons name="close" size={11} color={c.text} />
            </View>

            {/* Help button */}
            <View
              className="absolute top-2 right-2 w-[22px] h-[22px] rounded-full items-center justify-center"
              style={{ backgroundColor: `${c.bg}73` }}
            >
              <Text className="text-[10px] font-sans-bold" style={{ color: c.text }}>
                ?
              </Text>
            </View>

            {/* Macro overlay at bottom */}
            <View
              className="absolute bottom-2 left-2 right-2 rounded-lg p-1.5 flex-row justify-around"
              style={{ backgroundColor: `${c.bg}8c` }}
            >
              {[
                { label: 'P', value: '42g' },
                { label: 'C', value: '68g' },
                { label: 'F', value: '18g' },
              ].map((m) => (
                <View key={m.label} className="items-center">
                  <Text className="text-[8px]" style={{ color: `${c.text}99` }}>
                    {m.label}
                  </Text>
                  <Text className="text-[10px] font-sans-semibold" style={{ color: c.text }}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const { locale, setLocale, t } = useLocale();
  const c = useColors();
  const { height } = useWindowDimensions();
  const isShortScreen = height < 700;

  const toggleLocale = async () => {
    Haptics.selectionAsync();
    await setLocale(locale === 'en' ? 'mn' : 'en');
  };

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ThemeSelect');
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SignIn');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <StatusBar barStyle={c === darkPalette ? 'light-content' : 'dark-content'} />

      {/* Language toggle */}
      <Animated.View
        entering={FadeIn.duration(400).delay(400)}
        className="absolute top-14 right-5 z-10"
      >
        <Pressable
          onPress={toggleLocale}
          className="flex-row items-center gap-1.5 rounded-full px-3 py-[7px] border active:opacity-70"
          style={{ backgroundColor: c.card, borderColor: c.border }}
          accessibilityRole="button"
          accessibilityLabel={`Switch language to ${locale === 'en' ? 'Mongolian' : 'English'}`}
        >
          <Text className="text-[15px]">
            {locale === 'en' ? '\u{1F1FA}\u{1F1F8}' : '\u{1F1F2}\u{1F1F3}'}
          </Text>
          <Text className="text-xs font-sans-bold tracking-wider" style={{ color: c.text }}>
            {locale === 'en' ? 'EN' : 'MN'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Phone mockup */}
      <View className={`flex-1 items-center justify-center ${isShortScreen ? 'py-2' : 'py-4'}`}>
        <AppPreview />
      </View>

      {/* Bottom CTA */}
      <Animated.View entering={FadeInDown.duration(500).delay(300)} className="px-6 pb-10 pt-2">
        <Text
          className="text-4xl font-sans-bold text-text text-center leading-[44px] mb-7"
          accessibilityRole="header"
        >
          {t('welcome.headline')}
        </Text>

        <Pressable
          onPress={handleGetStarted}
          className="bg-primary-500 rounded-full items-center justify-center py-[18px] mb-4 active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel={t('welcome.getStarted')}
        >
          <Text className="text-[17px] font-sans-bold text-on-primary tracking-wide">
            {t('welcome.getStarted')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSignIn}
          className="items-center py-2 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('welcome.signIn')}
        >
          <Text className="text-[15px] text-text-secondary">
            {t('welcome.alreadyHaveAccount')}{' '}
            <Text className="font-sans-bold text-text">{t('welcome.signIn')}</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
