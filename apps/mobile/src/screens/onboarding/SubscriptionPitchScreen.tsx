import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SetupStackParamList, 'SubscriptionPitch'>;

const PREMIUM_FEATURES = [
  {
    icon: 'camera-outline' as const,
    color: '#6366f1',
    bg: '#6366f11a',
    title: 'AI Photo Logging',
    desc: 'Snap a photo and log any meal instantly',
  },
  {
    icon: 'mic-outline' as const,
    color: '#0ea5e9',
    bg: '#0ea5e91a',
    title: 'Voice Logging',
    desc: 'Say what you ate — Coach logs it for you',
  },
  {
    icon: 'analytics-outline' as const,
    color: '#10b981',
    bg: '#10b9811a',
    title: 'Advanced Analytics',
    desc: 'Weekly trends, nutrient deep-dives & more',
  },
  {
    icon: 'chatbubbles-outline' as const,
    color: '#f59e0b',
    bg: '#f59e0b1a',
    title: 'AI Coach Chat',
    desc: 'Ask anything about your nutrition & goals',
  },
  {
    icon: 'infinite-outline' as const,
    color: '#ec4899',
    bg: '#ec48991a',
    title: 'Unlimited History',
    desc: 'Access your full meal log, forever',
  },
] as const;

export function SubscriptionPitchScreen({ navigation }: Props) {
  const handleStartTrial = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('NotificationPermission');
  };

  const handleContinueFree = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('NotificationPermission');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#0f172a', '#1e293b']}
          style={{
            paddingTop: 40,
            paddingBottom: 32,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          {/* Badge */}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 100,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' }}>
              ✦ COACH PREMIUM
            </Text>
          </View>

          <Text
            style={{
              fontSize: 30,
              fontWeight: '800',
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 36,
              marginBottom: 10,
            }}
          >
            Your plan is ready.{'\n'}Now unlock it fully.
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            Get AI-powered tools that make hitting your{'\n'}daily targets effortless.
          </Text>

          {/* Price pill */}
          <View
            style={{
              marginTop: 24,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              paddingHorizontal: 20,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 }}>
              Then just
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: 'white', marginBottom: 4 }}>
                ₮
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff' }}>9,900</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
                /month
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#22c55e',
                borderRadius: 100,
                paddingHorizontal: 10,
                paddingVertical: 3,
                marginTop: 6,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                7-DAY FREE TRIAL
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Features list */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: '#ffffff',
              marginBottom: 16,
            }}
          >
            Everything in Premium
          </Text>

          <View style={{ gap: 10 }}>
            {PREMIUM_FEATURES.map((f) => (
              <View
                key={f.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#1c1c1e',
                  borderRadius: 16,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: f.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={f.icon} size={22} color={f.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '700', color: '#ffffff', marginBottom: 2 }}
                  >
                    {f.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#71717a', lineHeight: 17 }}>{f.desc}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              </View>
            ))}
          </View>

          {/* Social proof */}
          <View
            style={{
              backgroundColor: '#052e16',
              borderRadius: 16,
              padding: 16,
              marginTop: 20,
              borderWidth: 1,
              borderColor: '#14532d',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 16 }}>⭐⭐⭐⭐⭐</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#4ade80' }}>
                4.9 · 2,400+ reviews
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#86efac', lineHeight: 19, fontStyle: 'italic' }}>
              "Lost 8kg in 3 months. The AI photo logging changed everything — I actually log every
              meal now."
            </Text>
            <Text style={{ fontSize: 11, color: '#4ade80', marginTop: 6, fontWeight: '600' }}>
              — B. Munkhjargal, Ulaanbaatar
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 40,
          paddingTop: 16,
          backgroundColor: '#000000',
          borderTopWidth: 1,
          borderTopColor: '#2c2c2e',
          gap: 12,
        }}
      >
        <Pressable
          onPress={handleStartTrial}
          style={({ pressed }) => ({
            backgroundColor: '#ffffff',
            borderRadius: 100,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 18,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#000000' }}>
            Start 7-Day Free Trial
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>
            Cancel anytime before trial ends
          </Text>
        </Pressable>

        <Pressable
          onPress={handleContinueFree}
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={{ fontSize: 14, color: '#71717a', fontWeight: '500' }}>
            Continue with free plan
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
