import { Pressable, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconButtonSize = 'sm' | 'md';
type IconButtonVariant = 'surface' | 'ghost';

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
};

const iconSizes: Record<IconButtonSize, number> = {
  sm: 18,
  md: 20,
};

const variantClasses: Record<IconButtonVariant, string> = {
  surface: 'bg-surface-card border border-surface-border',
  ghost: 'bg-transparent',
};

export interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: keyof typeof Ionicons.glyphMap;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  iconColor?: string;
  className?: string;
}

export function IconButton({
  icon,
  size = 'md',
  variant = 'surface',
  iconColor = '#111218',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      className={`items-center justify-center rounded-full active:opacity-80 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      <Ionicons name={icon} size={iconSizes[size]} color={iconColor} />
    </Pressable>
  );
}
