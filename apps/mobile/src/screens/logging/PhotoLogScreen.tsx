import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Badge } from '../../components/ui';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'PhotoLog'>;

interface DraftItem {
  id: string;
  name: string;
  quantity: number;
  confidence: number;
}

export function PhotoLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<DraftItem[] | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await analyzePhoto(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await analyzePhoto(result.assets[0].uri);
    }
  };

  const analyzePhoto = async (_uri: string) => {
    setAnalyzing(true);
    setError(null);
    setDraft(null);
    try {
      // In production: upload via api.upload('/photos/upload', formData), poll draft
      await new Promise((r) => setTimeout(r, 2500));
      setDraft([
        { id: '1', name: 'Rice', quantity: 1, confidence: 0.92 },
        { id: '2', name: 'Chicken breast', quantity: 1, confidence: 0.85 },
        { id: '3', name: 'Mixed vegetables', quantity: 1, confidence: 0.78 },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      // Full impl: convert draft items to meal log via createMealLog
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setDraft((prev) =>
      prev?.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0.5, item.quantity + delta) }
          : item
      ) ?? null
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <View className="flex-row items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <Pressable onPress={() => navigation.goBack()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-4 text-lg font-sans-semibold text-text dark:text-slate-100">
          Photo Log
        </Text>
      </View>

      <ScrollView className="flex-1">
        {!photoUri && !analyzing && (
          <View className="flex-1 items-center justify-center px-8 py-16">
            <View className="mb-6 flex-row gap-4">
              <Pressable
                onPress={handleCapture}
                className="flex-1 items-center rounded-2xl border-2 border-dashed border-slate-300 py-8 dark:border-slate-600"
              >
                <Ionicons name="camera" size={48} color="#22c55e" />
                <Text className="mt-2 font-sans-medium text-text dark:text-slate-100">
                  Camera
                </Text>
              </Pressable>
              <Pressable
                onPress={handlePickFromGallery}
                className="flex-1 items-center rounded-2xl border-2 border-dashed border-slate-300 py-8 dark:border-slate-600"
              >
                <Ionicons name="images" size={48} color="#22c55e" />
                <Text className="mt-2 font-sans-medium text-text dark:text-slate-100">
                  Gallery
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {analyzing && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#22c55e" />
            <Text className="mt-4 text-text-secondary dark:text-slate-400">
              Analyzing...
            </Text>
          </View>
        )}

        {photoUri && !analyzing && (
          <View className="p-4">
            {photoUri && (
              <Image
                source={{ uri: photoUri }}
                className="mb-6 h-48 w-full rounded-2xl bg-slate-200"
                resizeMode="cover"
              />
            )}
            {draft && (
              <>
                <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
                  Identified foods (AIR-002)
                </Text>
                {draft.map((item) => (
                  <Card key={item.id} className="mb-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="font-sans-semibold text-text dark:text-slate-100">
                          {item.name}
                        </Text>
                        <Badge
                          variant={item.confidence >= 0.8 ? 'success' : 'warning'}
                          className="mt-1"
                        >
                          {Math.round(item.confidence * 100)}% confidence
                        </Badge>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => updateQuantity(item.id, -0.5)}
                          className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary dark:bg-slate-700"
                        >
                          <Ionicons name="remove" size={18} color="#475569" />
                        </Pressable>
                        <Text className="min-w-[40px] text-center font-sans-medium text-text dark:text-slate-100">
                          {item.quantity}
                        </Text>
                        <Pressable
                          onPress={() => updateQuantity(item.id, 0.5)}
                          className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary dark:bg-slate-700"
                        >
                          <Ionicons name="add" size={18} color="#475569" />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))}
                {error && (
                  <Text className="mb-4 text-center text-danger">{error}</Text>
                )}
                <Button
                  onPress={handleConfirmSave}
                  loading={saving}
                  disabled={saving}
                >
                  Confirm & Save
                </Button>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
