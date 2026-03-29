import { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BackButton, Button, BottomSheet, EmptyState } from '../../components/ui';
import { mealsApi, type BarcodeLookupResult } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';

type Props = LogStackScreenProps<'BarcodeScan'>;

export function BarcodeScanScreen() {
  const { t } = useLocale();
  const c = useColors();
  const { width } = useWindowDimensions();
  const scanFrameSize = width * 0.7;
  const navigation = useNavigation<Props['navigation']>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const scannedCodeRef = useRef<string | null>(null);

  const handleBarCodeScanned = useCallback(async ({ data }: { type: string; data: string }) => {
    if (scannedCodeRef.current === data) return;
    scannedCodeRef.current = data;
    setScannedCode(data);
    setScanned(true);
    setLoading(true);
    setResult(null);
    setNotFound(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await mealsApi.barcodeLookup(data);
      setResult(res.data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetScan = useCallback(() => {
    scannedCodeRef.current = null;
    setScanned(false);
    setResult(null);
    setNotFound(false);
    setQuantity(1);
  }, []);

  const handleSubmitProduct = useCallback(() => {
    navigation.navigate('BarcodeSubmit', {
      barcode: scannedCode || (scannedCodeRef.current ?? ''),
    });
  }, [navigation, scannedCode]);

  const handleSaveFromResult = async () => {
    if (!result?.food?.servings?.length) return;
    const serving = result.food.servings.find((s) => s.isDefault) ?? result.food.servings[0];
    setSaving(true);
    try {
      await mealsApi.createMealLog({
        source: 'barcode',
        items: [
          {
            foodId: result.food.id,
            servingId: serving.id,
            quantity,
          },
        ],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch {
      // show error
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustQuantity = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity((q) => Math.max(0.5, q + delta));
  };

  // Permission loading
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-app">
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-surface-app" edges={['top']}>
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">
            {t('logging.scanBarcode')}
          </Text>
        </View>
        <EmptyState
          icon="barcode"
          title={t('barcode.cameraRequired')}
          actionLabel={t('barcode.grantPermission')}
          onAction={requestPermission}
        />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        className="absolute inset-0"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
      />

      {/* Overlay */}
      <View
        className="absolute inset-0 items-center justify-center bg-black/40"
        pointerEvents="none"
      >
        <View
          className="rounded-xl border-2"
          style={{
            width: scanFrameSize,
            height: scanFrameSize,
            borderColor: c.primary,
            backgroundColor: 'transparent',
          }}
        />
      </View>

      {/* Header + Controls */}
      <SafeAreaView className="absolute inset-0 justify-between" edges={['top']}>
        <View className="flex-row items-center px-5 py-3">
          <BackButton variant="overlay" />
          <Text className="ml-4 text-lg font-sans-semibold text-white">
            {t('logging.scanBarcode')}
          </Text>
        </View>

        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="mt-3 text-white font-sans-medium text-base">
              {t('barcode.lookingUp')}
            </Text>
          </View>
        )}

        <View className="px-5 pb-8">
          {scanned && !loading && (
            <Button
              variant="secondary"
              onPress={resetScan}
              accessibilityLabel={t('barcode.scanAgain')}
            >
              {t('barcode.scanAgain')}
            </Button>
          )}
        </View>
      </SafeAreaView>

      {/* Result bottom sheet */}
      <BottomSheet
        visible={!!result && !loading}
        onClose={() => {
          setResult(null);
          resetScan();
        }}
      >
        {result && (
          <View>
            <Text className="mb-1 text-lg font-sans-semibold text-text">{result.food.name}</Text>
            {result.food.nutrients && (
              <Text className="mb-5 text-sm text-text-secondary">
                {result.food.nutrients.caloriesPer100g} cal / 100g
              </Text>
            )}

            {/* Quantity adjuster */}
            <View className="mb-5 flex-row items-center justify-center gap-6">
              <Pressable
                onPress={() => handleAdjustQuantity(-0.5)}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={22} color={c.textSecondary} />
              </Pressable>
              <Text className="min-w-[60px] text-center text-2xl font-sans-bold text-text">
                {quantity}
              </Text>
              <Pressable
                onPress={() => handleAdjustQuantity(0.5)}
                className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            <Button
              onPress={handleSaveFromResult}
              loading={saving}
              disabled={saving}
              accessibilityLabel={t('logging.addToLog')}
            >
              {t('logging.addToLog')}
            </Button>
          </View>
        )}
      </BottomSheet>

      {/* Not found bottom sheet */}
      <BottomSheet
        visible={notFound && !loading}
        onClose={() => {
          setNotFound(false);
          resetScan();
        }}
      >
        <View className="items-center">
          <View className="mb-4 h-16 w-16 rounded-full bg-surface-secondary items-center justify-center">
            <Ionicons name="help-outline" size={32} color={c.textTertiary} />
          </View>
          <Text className="mb-2 text-center text-lg font-sans-semibold text-text">
            {t('barcode.productNotFound')}
          </Text>
          <Text className="mb-6 text-center text-sm text-text-secondary leading-5">
            {t('barcode.notFoundDesc')}
          </Text>
          <Button onPress={handleSubmitProduct} accessibilityLabel={t('barcode.submitProduct')}>
            {t('barcode.submitProduct')}
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}
