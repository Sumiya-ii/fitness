import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BackButton, Input, Button } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import type { LogStackParamList } from '../../navigation/types';

type Route = RouteProp<LogStackParamList, 'BarcodeSubmit'>;

export function BarcodeSubmitScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const barcode = route.params?.barcode ?? '';

  const [productName, setProductName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [gramsPerServing, setGramsPerServing] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to capture the label.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const cal = parseFloat(calories);
    const prot = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;
    const grams = parseFloat(gramsPerServing);
    if (
      !productName.trim() ||
      isNaN(cal) ||
      cal < 0 ||
      isNaN(grams) ||
      grams <= 0 ||
      !servingLabel.trim()
    ) {
      setError('Please fill all required fields with valid values.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await mealsApi.submitBarcode({
        code: barcode,
        normalizedName: productName.trim(),
        caloriesPer100g: cal,
        proteinPer100g: prot,
        carbsPer100g: c,
        fatPer100g: f,
        servingLabel: servingLabel.trim(),
        gramsPerUnit: grams,
        // labelPhotoUrls would require upload endpoint - omit for now
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center border-b border-surface-border px-4 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">Submit Product</Text>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="p-4">
            <Input label="Barcode" value={barcode} editable={false} className="mb-4" />
            <Input
              label="Product name"
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Mongolian Milk 2.5%"
              className="mb-4"
            />
            <Input
              label="Calories per 100g"
              value={calories}
              onChangeText={setCalories}
              placeholder="0"
              keyboardType="decimal-pad"
              className="mb-4"
            />
            <Input
              label="Protein per 100g (g)"
              value={protein}
              onChangeText={setProtein}
              placeholder="0"
              keyboardType="decimal-pad"
              className="mb-4"
            />
            <Input
              label="Carbs per 100g (g)"
              value={carbs}
              onChangeText={setCarbs}
              placeholder="0"
              keyboardType="decimal-pad"
              className="mb-4"
            />
            <Input
              label="Fat per 100g (g)"
              value={fat}
              onChangeText={setFat}
              placeholder="0"
              keyboardType="decimal-pad"
              className="mb-4"
            />
            <Input
              label="Serving label"
              value={servingLabel}
              onChangeText={setServingLabel}
              placeholder="e.g. 1 cup, 100g"
              className="mb-4"
            />
            <Input
              label="Grams per serving"
              value={gramsPerServing}
              onChangeText={setGramsPerServing}
              placeholder="e.g. 100"
              keyboardType="decimal-pad"
              className="mb-6"
            />

            <Pressable
              onPress={handleCapturePhoto}
              className="mb-6 flex-row items-center justify-center rounded-xl border-2 border-dashed border-surface-border py-6"
            >
              <Ionicons name="camera-outline" size={32} color="#9a9caa" />
              <Text className="ml-2 font-sans-medium text-text-secondary">
                {photoUri ? 'Photo captured' : 'Capture label photo'}
              </Text>
            </Pressable>

            {error && <Text className="mb-4 text-center text-danger">{error}</Text>}

            <Button onPress={handleSubmit} loading={submitting} disabled={submitting}>
              Submit for Review
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
