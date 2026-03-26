import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import type { Gender } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type GenderOption = {
  id: Gender;
  label: string;
};

const OPTIONS: GenderOption[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'GenderSelect'>;

export function GenderSelectScreen({ navigation }: Props) {
  const gender = useProfileStore((s) => s.gender);
  const setGender = useProfileStore((s) => s.setGender);

  return (
    <OnboardingLayout
      step={4}
      totalSteps={TOTAL_STEPS}
      title="Choose your Gender"
      subtitle="This will be used to calibrate your custom plan."
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('BirthDateSelect')}
      continueDisabled={!gender}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: 12 }}>
          {OPTIONS.map((opt) => {
            const selected = gender === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setGender(opt.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? '#0f172a' : '#f5f5f7',
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 26,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: selected ? '700' : '500',
                    color: selected ? '#ffffff' : '#0b1220',
                    letterSpacing: 0.1,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}
