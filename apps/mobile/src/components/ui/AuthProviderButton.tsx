import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, type PressableProps } from 'react-native';

type AuthProviderTone = 'surface' | 'muted';

const toneClasses: Record<AuthProviderTone, string> = {
  surface: 'bg-surface-default border-surface-border',
  muted: 'bg-surface-secondary border-surface-border',
};

export interface AuthProviderButtonProps extends Omit<PressableProps, 'children'> {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: AuthProviderTone;
  className?: string;
}

export function AuthProviderButton({
  icon,
  label,
  tone = 'surface',
  className = '',
  ...props
}: AuthProviderButtonProps) {
  return (
    <Pressable
      className={`flex-1 flex-row items-center justify-center rounded-2xl border py-3.5 active:opacity-80 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      <Ionicons name={icon} size={20} color="#ffffff" />
      <Text className="ml-2 text-base leading-6 font-sans-medium text-text">{label}</Text>
    </Pressable>
  );
}
