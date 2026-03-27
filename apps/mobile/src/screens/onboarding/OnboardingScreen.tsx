import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import type { AuthStackParamList } from '../../navigation/types';
import { useLocale } from '../../i18n';
import { useColors, type ColorPalette } from '../../theme';

type OnboardingPage = {
  id: string;
  gradient: (c: ColorPalette) => [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subtitleKey: string;
};

const PAGES: OnboardingPage[] = [
  {
    id: '1',
    gradient: (c) => [c.border, c.muted],
    icon: 'nutrition-outline',
    titleKey: 'onboarding.trackNutrition',
    subtitleKey: 'onboarding.trackNutritionSubtitle',
  },
  {
    id: '2',
    gradient: (c) => [c.cardAlt, c.border],
    icon: 'sparkles-outline',
    titleKey: 'onboarding.aiInsights',
    subtitleKey: 'onboarding.aiInsightsSubtitle',
  },
  {
    id: '3',
    gradient: (c) => [c.border, c.cardAlt],
    icon: 'chatbubbles-outline',
    titleKey: 'onboarding.telegramCoach',
    subtitleKey: 'onboarding.telegramCoachSubtitle',
  },
  {
    id: '4',
    gradient: (c) => [c.cardAlt, c.muted],
    icon: 'trophy-outline',
    titleKey: 'onboarding.reachGoals',
    subtitleKey: 'onboarding.reachGoalsSubtitle',
  },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const { t } = useLocale();
  const c = useColors();
  const { width } = useWindowDimensions();
  const setOnboardingComplete = useOnboardingStore((s) => s.setOnboardingComplete);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLastPage = currentIndex === PAGES.length - 1;

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = async () => {
    if (isLastPage) {
      await setOnboardingComplete();
      navigation.replace('Welcome');
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleSkip = async () => {
    await setOnboardingComplete();
    navigation.replace('Welcome');
  };

  const renderItem: ListRenderItem<OnboardingPage> = ({ item }) => (
    <View style={{ width }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <View className="items-center mb-10">
          <LinearGradient
            colors={item.gradient(c)}
            className="w-40 h-40 rounded-3xl items-center justify-center"
            style={{ borderRadius: 24 }}
          >
            <Ionicons name={item.icon} size={80} color={c.text} />
          </LinearGradient>
        </View>
        <Text className="text-2xl font-sans-bold text-text text-center mb-3">
          {t(item.titleKey)}
        </Text>
        <Text className="text-base text-text-secondary text-center leading-6">
          {t(item.subtitleKey)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <View className="flex-1">
        <View className="flex-row justify-end px-6 pt-2">
          <Pressable
            onPress={handleSkip}
            className="py-2 px-4 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
          >
            <Text className="text-base font-sans-medium text-text-secondary">
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={PAGES}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
        />

        <View className="px-8 pb-10 pt-6">
          <View className="flex-row justify-center gap-2 mb-6">
            {PAGES.map((_, i) => (
              <View
                key={i}
                className={`h-2 rounded-full ${
                  i === currentIndex ? 'w-6 bg-primary-500' : 'w-2 bg-surface-muted'
                }`}
              />
            ))}
          </View>
          <Button onPress={handleNext} size="lg" className="w-full">
            {isLastPage ? t('onboarding.getStarted') : t('onboarding.next')}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
