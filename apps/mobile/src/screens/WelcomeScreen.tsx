import { View, Text, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useLocale } from '../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

function PhoneMockup() {
  return (
    <View
      style={{
        width: 260,
        height: 490,
        backgroundColor: '#1a1a1a',
        borderRadius: 44,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.35,
        shadowRadius: 40,
        elevation: 24,
      }}
    >
      {/* Screen */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#f0f0f0',
          borderRadius: 37,
          overflow: 'hidden',
        }}
      >
        {/* Status bar row */}
        <View
          style={{
            height: 30,
            backgroundColor: '#f0f0f0',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#0d0d0d' }}>2:10</Text>
          {/* Dynamic Island */}
          <View
            style={{
              width: 80,
              height: 20,
              backgroundColor: '#0d0d0d',
              borderRadius: 10,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="cellular" size={10} color="#0d0d0d" />
            <Ionicons name="wifi" size={10} color="#0d0d0d" />
            <Ionicons name="battery-full" size={10} color="#0d0d0d" />
          </View>
        </View>

        {/* App header */}
        <View
          style={{
            backgroundColor: '#f0f0f0',
            paddingHorizontal: 14,
            paddingTop: 6,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="sparkles" size={14} color="#0d0d0d" style={{ marginRight: 5 }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0d0d0d' }}>Coach</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#0d0d0d' }}>Today</Text>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#0d0d0d',
                  marginTop: 2,
                  alignSelf: 'center',
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: '#aaa' }}>Yesterday</Text>
          </View>
        </View>

        {/* Calorie card */}
        <View
          style={{
            marginHorizontal: 10,
            backgroundColor: '#ffffff',
            borderRadius: 14,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0d0d0d' }}>2,450</Text>
            <Text style={{ fontSize: 9, color: '#999', marginTop: 1 }}>Calories left</Text>
          </View>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 2.5,
              borderColor: '#e5e5e5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="flame-outline" size={18} color="#0d0d0d" />
          </View>
        </View>

        {/* Camera / food view */}
        <View style={{ flex: 1, position: 'relative' }}>
          <LinearGradient colors={['#4a2f18', '#2d1c0e', '#1a1208']} style={{ flex: 1 }} />

          {/* Corner brackets - top left */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              width: 20,
              height: 20,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderColor: 'rgba(255,255,255,0.75)',
            }}
          />
          {/* Top right */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              width: 20,
              height: 20,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor: 'rgba(255,255,255,0.75)',
            }}
          />
          {/* Bottom left */}
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 14,
              width: 20,
              height: 20,
              borderBottomWidth: 2,
              borderLeftWidth: 2,
              borderColor: 'rgba(255,255,255,0.75)',
            }}
          />
          {/* Bottom right */}
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              right: 14,
              width: 20,
              height: 20,
              borderBottomWidth: 2,
              borderRightWidth: 2,
              borderColor: 'rgba(255,255,255,0.75)',
            }}
          />

          {/* Close button */}
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={11} color="white" />
          </View>

          {/* Help button */}
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>?</Text>
          </View>

          {/* Macro overlay at bottom */}
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 8,
              padding: 6,
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            {[
              { label: 'P', value: '42g' },
              { label: 'C', value: '68g' },
              { label: 'F', value: '18g' },
            ].map((m) => (
              <View key={m.label} style={{ alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8 }}>{m.label}</Text>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const { locale, setLocale, t } = useLocale();

  const toggleLocale = async () => {
    await setLocale(locale === 'en' ? 'mn' : 'en');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Language toggle */}
      <View style={{ position: 'absolute', top: 56, right: 20, zIndex: 10 }}>
        <Pressable
          onPress={toggleLocale}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(28,28,30,0.95)',
            borderWidth: 1,
            borderColor: '#2c2c2e',
            borderRadius: 100,
            paddingHorizontal: 12,
            paddingVertical: 7,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 15 }}>{locale === 'en' ? '🇺🇸' : '🇲🇳'}</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: 0.5,
            }}
          >
            {locale === 'en' ? 'EN' : 'MN'}
          </Text>
        </Pressable>
      </View>

      {/* Phone mockup */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <PhoneMockup />
      </View>

      {/* Bottom CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}>
        <Text
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 44,
            marginBottom: 28,
          }}
        >
          {t('welcome.headline')}
        </Text>

        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          style={({ pressed }) => ({
            backgroundColor: '#ffffff',
            borderRadius: 100,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 18,
            marginBottom: 16,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: '#000000',
              letterSpacing: 0.2,
            }}
          >
            {t('welcome.getStarted')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 15, color: '#a1a1aa' }}>
            {t('welcome.alreadyHaveAccount')}{' '}
            <Text style={{ fontWeight: '700', color: '#ffffff' }}>{t('welcome.signIn')}</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
