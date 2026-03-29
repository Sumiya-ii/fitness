import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Input, Button, Card } from '../../components/ui';
import { mealsApi } from '../../api/meals';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { LogStackParamList } from '../../navigation/types';

type Route = RouteProp<LogStackParamList, 'BarcodeSubmit'>;

export function BarcodeSubmitScreen() {
  const { t } = useLocale();
  const c = useColors();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
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
      Alert.alert(t('common.permissionNeeded'), t('barcodeSubmit.cameraRequired'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const cal = parseFloat(calories);
    const prot = parseFloat(protein) || 0;
    const cb = parseFloat(carbs) || 0;
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
      setError(t('barcodeSubmit.fillAllFields'));
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
        carbsPer100g: cb,
        fatPer100g: f,
        servingLabel: servingLabel.trim(),
        gramsPerUnit: grams,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">
            {t('barcodeSubmit.title')}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="px-5 pt-4">
            {/* Barcode display */}
            <Animated.View entering={FadeInDown.duration(300).delay(50)}>
              <Card className="mb-6 flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-xl bg-surface-secondary items-center justify-center">
                  <Ionicons name="barcode-outline" size={20} color={c.textSecondary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-sans-medium text-text-tertiary">
                    {t('barcodeSubmit.barcode')}
                  </Text>
                  <Text className="text-base font-sans-semibold text-text">{barcode}</Text>
                </View>
              </Card>
            </Animated.View>

            {/* Product info section */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              <Text className="mb-3 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                {t('barcodeSubmit.productName')}
              </Text>
              <Input
                value={productName}
                onChangeText={setProductName}
                placeholder={t('barcodeSubmit.productNamePlaceholder')}
                accessibilityLabel={t('barcodeSubmit.productName')}
                containerClassName="mb-6"
              />
            </Animated.View>

            {/* Nutrition per 100g */}
            <Animated.View entering={FadeInDown.duration(300).delay(150)}>
              <Text className="mb-3 text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider">
                {t('barcodeSubmit.caloriesPer100g')}
              </Text>
              <Card className="mb-6">
                <View className="gap-4">
                  <Input
                    label={t('barcodeSubmit.caloriesPer100g')}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('barcodeSubmit.caloriesPer100g')}
                  />
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Input
                        label={t('barcodeSubmit.proteinPer100g')}
                        value={protein}
                        onChangeText={setProtein}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('barcodeSubmit.proteinPer100g')}
                      />
                    </View>
                    <View className="flex-1">
                      <Input
                        label={t('barcodeSubmit.carbsPer100g')}
                        value={carbs}
                        onChangeText={setCarbs}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('barcodeSubmit.carbsPer100g')}
                      />
                    </View>
                    <View className="flex-1">
                      <Input
                        label={t('barcodeSubmit.fatPer100g')}
                        value={fat}
                        onChangeText={setFat}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('barcodeSubmit.fatPer100g')}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* Serving info */}
            <Animated.View entering={FadeInDown.duration(300).delay(200)}>
              <View className="gap-4 mb-6">
                <Input
                  label={t('barcodeSubmit.servingLabel')}
                  value={servingLabel}
                  onChangeText={setServingLabel}
                  placeholder={t('barcodeSubmit.servingLabelPlaceholder')}
                  accessibilityLabel={t('barcodeSubmit.servingLabel')}
                />
                <Input
                  label={t('barcodeSubmit.gramsPerServing')}
                  value={gramsPerServing}
                  onChangeText={setGramsPerServing}
                  placeholder={t('barcodeSubmit.gramsPlaceholder')}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('barcodeSubmit.gramsPerServing')}
                />
              </View>
            </Animated.View>

            {/* Photo capture */}
            <Animated.View entering={FadeInDown.duration(300).delay(250)}>
              <Pressable
                onPress={handleCapturePhoto}
                accessibilityRole="button"
                accessibilityLabel={t('barcodeSubmit.captureLabel')}
                className="mb-6 items-center justify-center rounded-2xl border-2 border-dashed border-surface-border bg-surface-card py-6"
              >
                {photoUri ? (
                  <View className="items-center">
                    <Image
                      source={{ uri: photoUri }}
                      className="h-24 w-24 rounded-xl mb-2"
                      resizeMode="cover"
                    />
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="checkmark-circle" size={18} color={c.success} />
                      <Text className="text-sm font-sans-medium text-success">
                        {t('barcodeSubmit.photoCaptured')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="items-center">
                    <Ionicons name="camera-outline" size={32} color={c.textTertiary} />
                    <Text className="mt-2 text-sm font-sans-medium text-text-secondary">
                      {t('barcodeSubmit.captureLabel')}
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>

            {error ? (
              <View className="mb-4 rounded-2xl bg-danger/10 px-4 py-3">
                <Text className="text-center text-sm font-sans-medium text-danger">{error}</Text>
              </View>
            ) : null}

            <Animated.View entering={FadeInDown.duration(300).delay(300)}>
              <Button
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                accessibilityLabel={t('barcodeSubmit.submitForReview')}
              >
                {t('barcodeSubmit.submitForReview')}
              </Button>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
