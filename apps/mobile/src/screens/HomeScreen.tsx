import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 p-4">
        <Text className="text-2xl font-sans-bold text-primary-600">Dashboard</Text>
      </View>
    </SafeAreaView>
  );
}
