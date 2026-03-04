import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { MacroBar } from '../../components/ui/MacroBar';
import { useProfileStore } from '../../stores/profile.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

type Props = NativeStackScreenProps<any, 'TargetReview'>;

export function TargetReviewScreen({ navigation }: Props) {
  const getTargets = useProfileStore((s) => s.getTargets);
  const setProfileSetupComplete = useOnboardingStore((s) => s.setProfileSetupComplete);

  const targets = getTargets();

  const handleLooksGood = async () => {
    await setProfileSetupComplete();
    // RootNavigator will switch to Main when profileSetupComplete becomes true
  };

  const handleAdjust = () => {
    navigation.goBack();
  };

  if (!targets) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900 items-center justify-center">
        <Text className="text-text-secondary dark:text-slate-400">
          No targets calculated. Please complete profile setup.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <LinearGradient
        colors={['#22c55e', '#16a34a']}
        className="pt-8 pb-12 px-6"
        style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <Text className="text-2xl font-sans-bold text-white mb-1">Your Targets</Text>
        <Text className="text-base text-white/90">
          Based on your profile and goals
        </Text>
      </LinearGradient>

      <View className="flex-1 px-6 pt-8">
        <View className="items-center mb-10">
          <ProgressRing
            progress={1}
            size={140}
            color="#22c55e"
            backgroundColor="#e2e8f0"
            centerLabel={`${targets.calories}`}
            label="kcal / day"
          />
        </View>

        <View className="gap-4">
          <MacroBar
            label="Protein"
            current={0}
            target={targets.protein}
            color="#22c55e"
          />
          <MacroBar
            label="Carbs"
            current={0}
            target={targets.carbs}
            color="#0ea5e9"
          />
          <MacroBar
            label="Fat"
            current={0}
            target={targets.fat}
            color="#f59e0b"
          />
        </View>
      </View>

      <View className="px-6 pb-8 pt-6 gap-3">
        <Button onPress={handleLooksGood} size="lg" className="w-full">
          Looks Good!
        </Button>
        <Button onPress={handleAdjust} variant="outline" size="md" className="w-full">
          Adjust
        </Button>
      </View>
    </SafeAreaView>
  );
}
