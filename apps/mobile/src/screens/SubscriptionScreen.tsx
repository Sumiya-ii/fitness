import { View, Text, Pressable, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button, Badge } from '../components/ui';

const FEATURES_FREE = [
  'Manual logging',
  'Basic dashboard',
];

const FEATURES_PRO = [
  'Voice logging',
  'Photo logging',
  'Telegram coach',
  'Advanced analytics',
];

export function SubscriptionScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mr-4 p-2"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#475569" />
        </Pressable>
        <Text className="flex-1 text-xl font-sans-bold text-text dark:text-slate-100">
          Coach Pro
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#22c55e', '#16a34a', '#15803d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mx-4 mt-4 overflow-hidden rounded-2xl p-6"
        >
          <Text className="text-center text-2xl font-sans-bold text-white">
            Coach Pro
          </Text>
          <Text className="mt-2 text-center text-white/90">
            Unlock the full Coach experience
          </Text>
        </LinearGradient>

        <View className="mt-6 px-4">
          <Text className="mb-3 text-lg font-sans-semibold text-text dark:text-slate-100">
            Compare plans
          </Text>
          <View className="flex-row gap-4">
            <Card className="flex-1">
              <Text className="font-sans-semibold text-text dark:text-slate-100">
                Free
              </Text>
              {FEATURES_FREE.map((f) => (
                <View key={f} className="mt-2 flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <Text className="text-sm text-text-secondary dark:text-slate-400">
                    {f}
                  </Text>
                </View>
              ))}
            </Card>
            <Card className="flex-1 border-2 border-primary-500">
              <View className="flex-row items-center gap-2">
                <Text className="font-sans-semibold text-primary-600 dark:text-primary-400">
                  Pro
                </Text>
                <Badge variant="success">Best value</Badge>
              </View>
              {FEATURES_PRO.map((f) => (
                <View key={f} className="mt-2 flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <Text className="text-sm text-text dark:text-slate-200">
                    {f}
                  </Text>
                </View>
              ))}
            </Card>
          </View>

          <Text className="mt-6 mb-3 text-lg font-sans-semibold text-text dark:text-slate-100">
            Choose your plan
          </Text>
          <View className="gap-3">
            <Card>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-sans-semibold text-text dark:text-slate-100">
                    Monthly
                  </Text>
                  <Text className="text-sm text-text-secondary dark:text-slate-400">
                    Billed monthly
                  </Text>
                </View>
                <Text className="text-lg font-sans-bold text-text dark:text-slate-100">
                  $9.99/mo
                </Text>
              </View>
            </Card>
            <Card className="border-2 border-primary-500">
              <View className="flex-row items-center justify-between">
                <View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans-semibold text-text dark:text-slate-100">
                      Yearly
                    </Text>
                    <Badge variant="success">Save 40%</Badge>
                  </View>
                  <Text className="text-sm text-text-secondary dark:text-slate-400">
                    Billed annually
                  </Text>
                </View>
                <Text className="text-lg font-sans-bold text-text dark:text-slate-100">
                  $59.99/yr
                </Text>
              </View>
            </Card>
          </View>

          <Button variant="primary" size="lg" className="mt-6">
            Start Free Trial
          </Button>

          <Pressable className="mt-4 items-center py-2">
            <Text className="text-sm font-sans-medium text-primary-600 dark:text-primary-400">
              Restore Purchases
            </Text>
          </Pressable>

          <View className="mt-8 flex-row flex-wrap justify-center gap-4">
            <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Terms of Service
              </Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
              <Text className="text-sm text-text-secondary dark:text-slate-400">
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
