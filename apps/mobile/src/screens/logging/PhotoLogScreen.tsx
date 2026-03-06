import { useState, useRef, useEffect } from 'react';
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
import { api } from '../../api';
import { mealsApi } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';

type Props = LogStackScreenProps<'PhotoLog'>;

interface ParsedFoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

interface PhotoDraft {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  items?: ParsedFoodItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export function PhotoLogScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [draftItems, setDraftItems] = useState<ParsedFoodItem[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const pollDraft = async (draftId: string, attempt = 0) => {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setError('Analysis timed out. Please try again.');
      setAnalyzing(false);
      return;
    }

    try {
      const res = await api.get<{ data: PhotoDraft }>(`/photos/drafts/${draftId}`);
      const d = res.data;

      if (d.status === 'completed') {
        setDraft(d);
        setDraftItems(d.items ?? []);
        setAnalyzing(false);
        return;
      }

      if (d.status === 'failed') {
        setError('Photo analysis failed. Please try again.');
        setAnalyzing(false);
        return;
      }

      pollTimerRef.current = setTimeout(() => pollDraft(draftId, attempt + 1), POLL_INTERVAL_MS);
    } catch {
      setError('Failed to check analysis status.');
      setAnalyzing(false);
    }
  };

  const uploadAndAnalyze = async (uri: string) => {
    setAnalyzing(true);
    setError(null);
    setDraft(null);
    setDraftItems([]);

    try {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as unknown as Blob);

      const res = await api.upload<{ data: { draftId: string } }>('/photos/upload', formData);
      pollDraft(res.data.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await uploadAndAnalyze(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await uploadAndAnalyze(result.assets[0].uri);
    }
  };

  const handleConfirmSave = async () => {
    if (draftItems.length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const totalCalories = draftItems.reduce((s, i) => s + i.calories, 0);
      const totalProtein = draftItems.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = draftItems.reduce((s, i) => s + i.carbs, 0);
      const totalFat = draftItems.reduce((s, i) => s + i.fat, 0);
      const note = draftItems.map((i) => i.name).join(', ');

      await mealsApi.quickAdd({
        calories: Math.round(totalCalories),
        proteinGrams: Math.round(totalProtein),
        carbsGrams: Math.round(totalCarbs),
        fatGrams: Math.round(totalFat),
        note: `Photo: ${note}`,
        source: 'photo',
      });

      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateItemCalories = (index: number, delta: number) => {
    setDraftItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              calories: Math.max(0, item.calories + delta),
            }
          : item,
      ),
    );
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <Pressable onPress={() => navigation.goBack()} className="p-1">
            <Ionicons name="arrow-back" size={24} color="#e2e8f0" />
          </Pressable>
          <Text className="ml-4 text-lg font-sans-semibold text-text">
            Photo Log
          </Text>
        </View>

        <ScrollView className="flex-1">
          {!photoUri && !analyzing && (
            <View className="flex-1 items-center justify-center px-8 py-16">
              <View className="mb-6 flex-row gap-4">
                <Pressable
                  onPress={handleCapture}
                  className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-8"
                >
                  <Ionicons name="camera" size={48} color="#1f2028" />
                  <Text className="mt-2 font-sans-medium text-text">
                    Camera
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handlePickFromGallery}
                  className="flex-1 items-center rounded-2xl border-2 border-dashed border-surface-border py-8"
                >
                  <Ionicons name="images" size={48} color="#1f2028" />
                  <Text className="mt-2 font-sans-medium text-text">
                    Gallery
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {analyzing && (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#1f2028" />
              <Text className="mt-4 text-text-secondary">
                Analyzing your food...
              </Text>
            </View>
          )}

          {photoUri && !analyzing && (
            <View className="p-4">
              <Image
                source={{ uri: photoUri }}
                className="mb-6 h-48 w-full rounded-2xl bg-surface-secondary"
                resizeMode="cover"
              />
              {draftItems.length > 0 && (
                <>
                  <Text className="mb-3 font-sans-semibold text-text">
                    Identified foods
                  </Text>
                  {draftItems.map((item, index) => (
                    <Card key={`${item.name}-${index}`} className="mb-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-sans-semibold text-text">
                            {item.name}
                          </Text>
                          <Text className="text-xs text-text-secondary mt-0.5">
                            P: {Math.round(item.protein)}g · C: {Math.round(item.carbs)}g · F: {Math.round(item.fat)}g
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
                            onPress={() => updateItemCalories(index, -25)}
                            className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary"
                          >
                            <Ionicons name="remove" size={18} color="#9a9caa" />
                          </Pressable>
                          <Text className="min-w-[50px] text-center font-sans-medium text-text">
                            {item.calories} cal
                          </Text>
                          <Pressable
                            onPress={() => updateItemCalories(index, 25)}
                            className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary"
                          >
                            <Ionicons name="add" size={18} color="#9a9caa" />
                          </Pressable>
                        </View>
                      </View>
                    </Card>
                  ))}

                  <View className="rounded-xl bg-surface-card border border-surface-border p-3 mb-4">
                    <Text className="text-sm text-text-secondary font-sans-medium mb-1">Total</Text>
                    <Text className="text-text font-sans-semibold">
                      {draftItems.reduce((s, i) => s + i.calories, 0)} cal ·{' '}
                      P: {Math.round(draftItems.reduce((s, i) => s + i.protein, 0))}g ·{' '}
                      C: {Math.round(draftItems.reduce((s, i) => s + i.carbs, 0))}g ·{' '}
                      F: {Math.round(draftItems.reduce((s, i) => s + i.fat, 0))}g
                    </Text>
                  </View>

                  {error && (
                    <Text className="mb-4 text-center text-red-400">{error}</Text>
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

              {draft && draftItems.length === 0 && (
                <View className="items-center py-8">
                  <Text className="text-text-secondary">No food items could be identified.</Text>
                  <Button
                    variant="outline"
                    onPress={() => {
                      setPhotoUri(null);
                      setDraft(null);
                    }}
                    className="mt-4"
                  >
                    Try another photo
                  </Button>
                </View>
              )}
            </View>
          )}

          {error && !photoUri && !analyzing && (
            <View className="items-center py-8 px-4">
              <Text className="text-center text-red-400">{error}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
