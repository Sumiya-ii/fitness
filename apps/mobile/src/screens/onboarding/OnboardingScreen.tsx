import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  type ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import type { AuthStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingPage = {
  id: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const PAGES: OnboardingPage[] = [
  {
    id: '1',
    gradient: ['#22c55e', '#16a34a'],
    icon: 'nutrition-outline',
    title: 'Track Your Nutrition',
    subtitle: 'Log meals quickly and easily. Stay on top of what you eat with our intuitive food logging.',
  },
  {
    id: '2',
    gradient: ['#a855f7', '#7e22ce'],
    icon: 'sparkles-outline',
    title: 'AI-Powered Insights',
    subtitle: 'Use voice or photo to log meals. Our AI understands what you ate and helps you stay accurate.',
  },
  {
    id: '3',
    gradient: ['#0ea5e9', '#0284c7'],
    icon: 'chatbubbles-outline',
    title: 'Telegram Coach',
    subtitle: 'Get daily accountability through Telegram. Log meals on the go and stay motivated.',
  },
  {
    id: '4',
    gradient: ['#f59e0b', '#d97706'],
    icon: 'trophy-outline',
    title: 'Reach Your Goals',
    subtitle: 'Personalized calorie and macro targets based on your profile. Track progress and succeed.',
  },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const setOnboardingComplete = useOnboardingStore((s) => s.setOnboardingComplete);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLastPage = currentIndex === PAGES.length - 1;

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems[0]?.index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

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
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 px-8">
      <View className="flex-1 justify-center">
        <View className="items-center mb-10">
          <LinearGradient
            colors={item.gradient as [string, string]}
            className="w-40 h-40 rounded-3xl items-center justify-center"
            style={{ borderRadius: 24 }}
          >
            <Ionicons name={item.icon} size={80} color="white" />
          </LinearGradient>
        </View>
        <Text className="text-2xl font-sans-bold text-text text-center mb-3 dark:text-slate-100">
          {item.title}
        </Text>
        <Text className="text-base text-text-secondary text-center leading-6 dark:text-slate-400">
          {item.subtitle}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900">
      <View className="flex-1">
        <View className="flex-row justify-end px-6 pt-2">
          <Pressable onPress={handleSkip} className="py-2 px-4 active:opacity-70">
            <Text className="text-base font-sans-medium text-primary-600 dark:text-primary-400">
              Skip
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
                  i === currentIndex ? 'w-6 bg-primary-500' : 'w-2 bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </View>
          <Button onPress={handleNext} size="lg" className="w-full">
            {isLastPage ? 'Get Started' : 'Next'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
