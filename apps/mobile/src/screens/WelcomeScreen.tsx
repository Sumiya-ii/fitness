import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StatusBar,
  FlatList,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';
import { useLocale } from '../i18n';
import { useColors } from '../theme';
import { useThemeStore } from '../stores/theme.store';
import { PrimaryPillButton } from '../components/ui';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

type CardKey = 'recognize' | 'voice' | 'targets';

interface CardDef {
  key: CardKey;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subKey: string;
}

const CARDS: CardDef[] = [
  {
    key: 'recognize',
    icon: 'restaurant',
    titleKey: 'welcome.cards.recognize.title',
    subKey: 'welcome.cards.recognize.sub',
  },
  {
    key: 'voice',
    icon: 'mic',
    titleKey: 'welcome.cards.voice.title',
    subKey: 'welcome.cards.voice.sub',
  },
  {
    key: 'targets',
    icon: 'flag',
    titleKey: 'welcome.cards.targets.title',
    subKey: 'welcome.cards.targets.sub',
  },
];

interface CarouselCardProps {
  card: CardDef;
  width: number;
}

function CarouselCard({ card, width }: CarouselCardProps) {
  const { t } = useLocale();
  const c = useColors();

  return (
    <View style={{ width }} className="px-5">
      <View className="flex-1 rounded-3xl overflow-hidden" style={{ backgroundColor: c.card }}>
        {/* Illustration area */}
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.cardAlt }}>
          <View
            className="h-24 w-24 rounded-full items-center justify-center"
            style={{ backgroundColor: c.card }}
          >
            <Ionicons name={card.icon} size={44} color={c.text} />
          </View>
        </View>

        {/* Caption */}
        <View className="px-5 py-5">
          <Text
            className="text-xl font-sans-bold mb-1.5"
            style={{ color: c.text, letterSpacing: -0.3 }}
            accessibilityRole="header"
          >
            {t(card.titleKey)}
          </Text>
          <Text className="text-sm font-sans leading-5" style={{ color: c.textSecondary }}>
            {t(card.subKey)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const { locale, setLocale, t } = useLocale();
  const c = useColors();
  const scheme = useThemeStore((s) => s.scheme);
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<CardDef>>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(
    ({ item }: { item: CardDef }) => <CarouselCard card={item} width={width} />,
    [width],
  );

  const toggleLocale = async () => {
    Haptics.selectionAsync();
    await setLocale(locale === 'en' ? 'mn' : 'en');
  };

  const handleGetStarted = () => {
    navigation.navigate('GoalSetup');
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SignIn');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Carousel — top 40%+ */}
      <Animated.View entering={FadeIn.duration(500)} className="flex-[1.1] pt-2">
        <FlatList
          ref={listRef}
          data={CARDS}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          decelerationRate="fast"
          accessibilityRole="adjustable"
          accessibilityLabel={t('welcome.headline')}
        />

        {/* Page indicator dots */}
        <View
          className="flex-row items-center justify-center gap-1.5 mt-4"
          accessibilityRole="tablist"
        >
          {CARDS.map((card, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={card.key}
                className="h-2 rounded-full"
                style={{
                  width: isActive ? 24 : 8,
                  backgroundColor: isActive ? c.primary : c.border,
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              />
            );
          })}
        </View>
      </Animated.View>

      {/* Headline + tagline */}
      <Animated.View entering={FadeInDown.duration(500).delay(150)} className="px-6 pt-6">
        <Text
          className="text-3xl font-sans-bold text-text text-center leading-[38px]"
          accessibilityRole="header"
        >
          {t('welcome.headline')}
        </Text>
      </Animated.View>

      {/* Bottom CTAs */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(250)}
        className="px-5 pb-6 pt-6 gap-3"
      >
        <PrimaryPillButton
          label={t('welcome.getStarted')}
          onPress={handleGetStarted}
          accessibilityLabel={t('welcome.getStarted')}
        />

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

        {/* Inline language toggle */}
        <View className="flex-row justify-center pt-1">
          <Pressable
            onPress={toggleLocale}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
            style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}
            accessibilityRole="button"
            accessibilityLabel={`Switch language to ${locale === 'en' ? 'Mongolian' : 'English'}`}
            hitSlop={8}
          >
            <Text className="text-[14px]">
              {locale === 'en' ? '\u{1F1FA}\u{1F1F8}' : '\u{1F1F2}\u{1F1F3}'}
            </Text>
            <Text
              className="text-xs font-sans-bold tracking-wider"
              style={{ color: c.textSecondary }}
            >
              {locale === 'en' ? 'EN' : 'MN'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
