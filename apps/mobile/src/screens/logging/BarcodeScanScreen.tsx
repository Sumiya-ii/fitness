import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BackButton, Button, BottomSheet } from '../../components/ui';
import { mealsApi, type BarcodeLookupResult } from '../../api/meals';
import type { LogStackScreenProps } from '../../navigation/types';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';

type Props = LogStackScreenProps<'BarcodeScan'>;

export function BarcodeScanScreen() {
  const { t } = useLocale();
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
      navigation.goBack();
    } catch {
      // show error
    } finally {
      setSaving(false);
    }
  };

  const c = useColors();

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
        <View className="flex-row items-center border-b border-surface-border px-4 py-3">
          <BackButton />
          <Text className="ml-3 text-lg font-sans-semibold text-text">
            {t('logging.scanBarcode')}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-4 text-center text-text">{t('barcode.cameraRequired')}</Text>
          <Button onPress={requestPermission}>{t('barcode.grantPermission')}</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
      />
      {/* Overlay frame */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.frame, { width: scanFrameSize, height: scanFrameSize }]} />
      </View>

      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']} className="justify-between">
        <View className="flex-row items-center px-4 py-3">
          <BackButton variant="overlay" />
          <Text className="ml-4 text-lg font-sans-semibold text-text">
            {t('logging.scanBarcode')}
          </Text>
        </View>

        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="mt-2 text-text">{t('barcode.lookingUp')}</Text>
          </View>
        )}

        <View className="px-4 pb-8">
          {scanned && !loading && (
            <Button variant="secondary" onPress={resetScan}>
              {t('barcode.scanAgain')}
            </Button>
          )}
        </View>
      </SafeAreaView>

      {/* Result BottomSheet */}
      <BottomSheet
        visible={!!result && !loading}
        onClose={() => {
          setResult(null);
          resetScan();
        }}
      >
        {result && (
          <View>
            <Text className="mb-2 text-lg font-sans-semibold text-text">{result.food.name}</Text>
            {result.food.nutrients && (
              <Text className="mb-4 text-sm text-text-secondary">
                {result.food.nutrients.caloriesPer100g} cal / 100g
              </Text>
            )}
            <View className="mb-4 flex-row items-center justify-center gap-4">
              <Pressable
                onPress={() => setQuantity((q) => Math.max(0.5, q - 0.5))}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={24} color="#777985" />
              </Pressable>
              <Text className="min-w-[60px] text-center text-xl font-sans-bold text-text">
                {quantity}
              </Text>
              <Pressable
                onPress={() => setQuantity((q) => q + 0.5)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={24} color="#777985" />
              </Pressable>
            </View>
            <Button onPress={handleSaveFromResult} loading={saving} disabled={saving}>
              {t('logging.addToLog')}
            </Button>
          </View>
        )}
      </BottomSheet>

      {/* Not found BottomSheet */}
      <BottomSheet
        visible={notFound && !loading}
        onClose={() => {
          setNotFound(false);
          resetScan();
        }}
      >
        <View className="items-center">
          <Text className="mb-2 text-center text-lg font-sans-semibold text-text">
            {t('barcode.productNotFound')}
          </Text>
          <Text className="mb-6 text-center text-text-secondary">{t('barcode.notFoundDesc')}</Text>
          <Button onPress={handleSubmitProduct}>{t('barcode.submitProduct')}</Button>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  frame: {
    borderWidth: 2,
    borderColor: '#1f2028',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
});
