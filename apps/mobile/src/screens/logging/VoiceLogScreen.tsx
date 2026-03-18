import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../i18n';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'VoiceLog'>;

export function VoiceLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const { t } = useLocale();

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <Pressable onPress={() => navigation.goBack()} className="p-3 -m-3">
            <Ionicons name="arrow-back" size={24} color="#9a9caa" />
          </Pressable>
          <Text className="ml-4 text-lg font-sans-semibold text-text">{t('logging.voiceLog')}</Text>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full rounded-3xl bg-surface-card border border-surface-border p-8 items-center">
            <View className="h-20 w-20 rounded-full bg-primary-500/10 items-center justify-center mb-5">
              <Ionicons name="mic" size={38} color="#1f2028" />
            </View>
            <Text className="text-xl font-sans-bold text-text mb-2">{t('logging.voice')}</Text>
            <View className="rounded-full bg-amber-500/15 px-3 py-1 mb-4">
              <Text className="text-xs font-sans-semibold text-amber-600 uppercase tracking-wider">
                Coming Soon
              </Text>
            </View>
            <Text className="text-sm text-text-secondary text-center leading-5">
              Voice logging is being built. Use text search or photo logging to track your meals in
              the meantime.
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('TextSearch')}
            className="mt-6 flex-row items-center gap-2 rounded-2xl bg-primary-500 px-6 py-3.5"
          >
            <Ionicons name="search" size={18} color="#ffffff" />
            <Text className="font-sans-semibold text-text-inverse">{t('logging.textSearch')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
