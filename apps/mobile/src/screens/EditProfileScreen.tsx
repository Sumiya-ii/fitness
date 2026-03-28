import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BackButton } from '../components/ui';
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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(true);
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
        <View className="flex-row items-center px-4 py-3">
          <BackButton />
          <Text className="flex-1 text-lg font-sans-bold text-text text-center mr-10">
            {t('settings.editProfile')}
          </Text>
        </View>

        <View className="flex-1 px-4 pt-8">
          {/* Avatar */}
          <View className="items-center mb-8">
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-24 w-24 rounded-full items-center justify-center"
            >
              <Text className="text-white text-3xl font-sans-bold">
                {getInitials(nameInput || profile?.displayName)}
              </Text>
            </LinearGradient>
          </View>

          {/* Name input */}
          <View className="bg-surface-card rounded-2xl px-4 py-2 border border-surface-border">
            <Text className="text-xs text-text-tertiary font-sans-medium mt-2">
              {t('settings.displayName')}
            </Text>
            <TextInput
              className="text-text font-sans-medium text-[16px] py-3"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              placeholderTextColor={c.textTertiary}
              placeholder={t('settings.yourName')}
            />
          </View>

          {/* Save button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleSave();
            }}
            disabled={!hasChanges || saving}
            className="mt-6"
          >
            <LinearGradient
              colors={hasChanges ? ['#667eea', '#764ba2'] : [c.muted, c.muted]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="rounded-2xl py-4 items-center"
            >
              <Text className="text-white text-[16px] font-sans-bold">
                {saving ? t('common.saving') : t('common.save')}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
