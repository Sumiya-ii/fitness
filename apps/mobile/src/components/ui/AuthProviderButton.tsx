import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, type PressableProps } from 'react-native';

type AuthProviderTone = 'surface' | 'muted';

const toneClasses: Record<AuthProviderTone, string> = {
  surface: 'bg-surface-card border-surface-border',
  muted: 'bg-surface-muted border-surface-border',
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
      className={`flex-1 flex-row items-center justify-center rounded-xl border py-3 active:opacity-80 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      <Ionicons name={icon} size={20} color="#111218" />
      <Text className="ml-2 font-sans-medium text-text">{label}</Text>
    </Pressable>
  );
}
