import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button } from '../components/ui';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

interface ProfileData {
  displayName: string | null;
}

export function EditProfileScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [_loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useState(() => {
    api
      .get<{ data: ProfileData }>('/profile')
      .then((res) => {
        setProfile(res.data);
        setNameInput(res.data.displayName ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.put('/profile', { displayName: trimmed });
      setProfile((p) => (p ? { ...p, displayName: trimmed } : p));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch {
      Alert.alert(t('common.error'), t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = nameInput.trim() !== (profile?.displayName ?? '');

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('settings.editProfile')}
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 24),
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <Animated.View
              entering={FadeInDown.duration(400).springify()}
              className="items-center mt-8 mb-8"
            >
              <View
                className="h-24 w-24 rounded-full items-center justify-center"
                style={{ backgroundColor: c.primary }}
              >
                <Text className="text-3xl font-sans-bold" style={{ color: c.onPrimary }}>
                  {getInitials(nameInput || profile?.displayName)}
                </Text>
              </View>
            </Animated.View>

            {/* Name input */}
            <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
              <View className="bg-surface-card rounded-2xl px-4 pt-3 pb-1 border border-surface-border">
                <Text
                  className="text-xs leading-5 font-sans-medium"
                  style={{ color: c.textTertiary }}
                >
                  {t('settings.displayName')}
                </Text>
                <TextInput
                  className="text-base leading-6 font-sans-medium py-3 text-text"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  placeholderTextColor={c.textTertiary}
                  placeholder={t('settings.yourName')}
                  accessibilityLabel={t('settings.displayName')}
                />
              </View>
            </Animated.View>

            {/* Save button */}
            <Animated.View entering={FadeInDown.duration(400).delay(200).springify()}>
              <View className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleSave}
                  disabled={!hasChanges}
                  loading={saving}
                  accessibilityLabel={t('common.save')}
                >
                  {t('common.save')}
                </Button>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
