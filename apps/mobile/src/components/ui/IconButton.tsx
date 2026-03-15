import { Pressable, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconButtonSize = 'sm' | 'md';
type IconButtonVariant = 'surface' | 'ghost';

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-11 w-11',
  md: 'h-11 w-11',
};

const iconSizes: Record<IconButtonSize, number> = {
  sm: 18,
  md: 20,
};

const variantClasses: Record<IconButtonVariant, string> = {
  surface: 'bg-surface-default border border-surface-border shadow-sm shadow-black/5',
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
  iconColor = '#0b1220',
  className = '',
  accessibilityLabel,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      className={`items-center justify-center rounded-full active:opacity-80 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? String(icon)}
      {...props}
    >
      <Ionicons name={icon} size={iconSizes[size]} color={iconColor} />
    </Pressable>
  );
}
