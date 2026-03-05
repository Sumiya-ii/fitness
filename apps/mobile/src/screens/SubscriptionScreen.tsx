import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Linking,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Badge } from '../components/ui';
import { api } from '../api/client';

const FEATURES_PRO = [
  { label: 'Voice logging', icon: 'mic-outline' as const },
  { label: 'Photo logging', icon: 'camera-outline' as const },
  { label: 'Telegram coach', icon: 'paper-plane-outline' as const },
  { label: 'Advanced analytics', icon: 'analytics-outline' as const },
  { label: 'Priority support', icon: 'headset-outline' as const },
];

type Plan = 'monthly' | 'yearly';

interface QPayBankUrl {
  name: string;
  description: string;
  logo?: string;
  link: string;
}

interface InvoiceData {
  invoiceId: string;
  qpayInvoiceId: string;
  qrText: string;
  qrImage: string;
  urls: QPayBankUrl[];
  amount: number;
  plan: string;
}

const BANK_ICONS: Record<string, string> = {
  'Khan bank': 'business-outline',
  'State bank': 'business-outline',
  'Xac bank': 'business-outline',
  'Trade and Development bank': 'business-outline',
  'Most money': 'wallet-outline',
  'National investment bank': 'business-outline',
  'Chinggis khaan bank': 'business-outline',
  'Capitron bank': 'business-outline',
  'Bogd bank': 'business-outline',
  'Candy pay': 'wallet-outline',
};

const PLAN_PRICES: Record<Plan, { amount: string; period: string; yearly?: string }> = {
  monthly: { amount: '19,900₮', period: '/сар' },
  yearly: { amount: '149,900₮', period: '/жил', yearly: '12,490₮/сар' },
};

const POLL_INTERVAL_MS = 3000;

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollPaymentStatus = useCallback(
    (invoiceId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get<{ data: { status: string; paidAt: string | null } }>(
            `/qpay/invoice/${invoiceId}/status`,
          );
          if (res.data.status === 'paid') {
            stopPolling();
            setPaymentSuccess(true);
          }
        } catch {
          // ignore polling errors
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ data: InvoiceData }>('/qpay/invoice', {
        plan: selectedPlan,
      });
      setInvoice(res.data);
      pollPaymentStatus(res.data.invoiceId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBank = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'App not installed',
          'This banking app is not installed on your device.',
        );
      }
    } catch {
      Alert.alert('Error', 'Could not open the banking app.');
    }
  };

  if (paymentSuccess) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center px-6">
        <SafeAreaView className="items-center">
          <View className="h-24 w-24 rounded-full bg-primary-500/20 items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text className="text-2xl font-sans-bold text-white text-center mb-2">
            Амжилттай!
          </Text>
          <Text className="text-base text-slate-400 text-center mb-8">
            Coach Pro эрхийг амжилттай идэвхжүүллээ. Бүх Pro боломжуудыг ашиглах боломжтой боллоо.
          </Text>
          <Button variant="primary" size="lg" onPress={() => navigation.goBack()}>
            Үргэлжлүүлэх
          </Button>
        </SafeAreaView>
      </View>
    );
  }

  if (invoice) {
    return (
      <View className="flex-1 bg-slate-950">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-4 py-3">
            <Pressable
              onPress={() => {
                stopPolling();
                setInvoice(null);
              }}
              className="h-10 w-10 rounded-full bg-slate-900 items-center justify-center mr-3"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color="#94a3b8" />
            </Pressable>
            <Text className="flex-1 text-xl font-sans-bold text-white">
              Төлбөр төлөх
            </Text>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* QR Code */}
            <Animated.View entering={FadeInDown.duration(400)} className="px-4 mt-2">
              <View className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 items-center">
                <Text className="text-lg font-sans-semibold text-white mb-1">
                  QR кодоор төлөх
                </Text>
                <Text className="text-sm text-slate-400 mb-4 text-center">
                  Банкны аппаараа QR кодыг уншуулна уу
                </Text>

                <View className="bg-white rounded-2xl p-4 mb-4">
                  <Image
                    source={{ uri: `data:image/png;base64,${invoice.qrImage}` }}
                    style={{ width: 220, height: 220 }}
                    resizeMode="contain"
                  />
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                  <Text className="text-sm text-slate-400">
                    Төлбөр хүлээж байна...
                  </Text>
                </View>

                <View className="mt-3 px-4 py-2 rounded-xl bg-slate-800">
                  <Text className="text-lg font-sans-bold text-primary-400 text-center">
                    {invoice.amount.toLocaleString()}₮
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Bank App Buttons */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              className="px-4 mt-6"
            >
              <Text className="text-lg font-sans-semibold text-white mb-3">
                Банкны апп-аар төлөх
              </Text>
              <Text className="text-sm text-slate-400 mb-4">
                Банкны аппаа сонгон шууд төлбөрөө хийнэ үү
              </Text>

              <View className="gap-2">
                {invoice.urls.map((bank) => (
                  <Pressable
                    key={bank.name}
                    onPress={() => handleOpenBank(bank.link)}
                    className="flex-row items-center rounded-2xl bg-slate-900/80 border border-slate-800 p-4 active:bg-slate-800"
                  >
                    <View className="h-10 w-10 rounded-xl bg-primary-500/15 items-center justify-center mr-3">
                      <Ionicons
                        name={(BANK_ICONS[bank.name] ?? 'business-outline') as any}
                        size={20}
                        color="#22c55e"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-medium text-white">
                        {bank.name}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        {bank.description}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color="#64748b" />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-slate-900 items-center justify-center mr-3"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </Pressable>
          <Text className="flex-1 text-xl font-sans-bold text-white">
            Coach Pro
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(400)} className="px-4 mt-2">
            <LinearGradient
              colors={['#059669', '#22c55e', '#4ade80']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="overflow-hidden rounded-3xl p-6 items-center"
            >
              <View className="h-16 w-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
                <Ionicons name="diamond" size={32} color="#ffffff" />
              </View>
              <Text className="text-2xl font-sans-bold text-white">
                Coach Pro
              </Text>
              <Text className="mt-1 text-center text-white/80 text-sm">
                Coach-ийн бүрэн боломжуудыг нээх
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Pro Features */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="px-4 mt-6"
          >
            <Text className="text-lg font-sans-semibold text-white mb-3">
              Pro боломжууд
            </Text>
            <View className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
              {FEATURES_PRO.map((f, i) => (
                <View key={f.label}>
                  <View className="flex-row items-center gap-3 py-3">
                    <View className="h-9 w-9 rounded-xl bg-primary-500/15 items-center justify-center">
                      <Ionicons name={f.icon} size={18} color="#22c55e" />
                    </View>
                    <Text className="flex-1 font-sans-medium text-white">
                      {f.label}
                    </Text>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  </View>
                  {i < FEATURES_PRO.length - 1 && (
                    <View className="h-px bg-slate-800" />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Plans */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            className="px-4 mt-6"
          >
            <Text className="text-lg font-sans-semibold text-white mb-3">
              Төлөвлөгөө сонгох
            </Text>
            <View className="gap-3">
              <Pressable
                onPress={() => setSelectedPlan('yearly')}
                className={`rounded-2xl border p-4 ${
                  selectedPlan === 'yearly'
                    ? 'bg-primary-500/10 border-primary-500'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans-semibold text-white text-base">
                        Жилийн
                      </Text>
                      <Badge variant="success">37% хэмнэлт</Badge>
                    </View>
                    <Text className="text-sm text-slate-400 mt-1">
                      {PLAN_PRICES.yearly.yearly}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-sans-bold text-white">
                      {PLAN_PRICES.yearly.amount}
                    </Text>
                    <Text className="text-xs text-slate-400">{PLAN_PRICES.yearly.period}</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setSelectedPlan('monthly')}
                className={`rounded-2xl border p-4 ${
                  selectedPlan === 'monthly'
                    ? 'bg-primary-500/10 border-primary-500'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-sans-semibold text-white text-base">
                      Сарын
                    </Text>
                    <Text className="text-sm text-slate-400 mt-1">
                      Сар бүр нэхэмжлэгдэнэ
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-sans-bold text-white">
                      {PLAN_PRICES.monthly.amount}
                    </Text>
                    <Text className="text-xs text-slate-400">{PLAN_PRICES.monthly.period}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* CTA */}
          <View className="px-4 mt-6">
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleSubscribe}
            >
              QPay-ээр төлөх
            </Button>

            <View className="mt-6 flex-row flex-wrap justify-center gap-4">
              <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
                <Text className="text-xs text-slate-500">Үйлчилгээний нөхцөл</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
                <Text className="text-xs text-slate-500">Нууцлалын бодлого</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
