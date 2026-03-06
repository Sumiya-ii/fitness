import * as Haptics from 'expo-haptics';
import {
  type ComponentProps,
  forwardRef,
  useCallback,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';
import { themeColors } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 active:bg-primary-600 shadow-sm shadow-black/10',
  secondary:
    'bg-surface-card active:bg-surface-secondary border border-surface-border',
  outline:
    'bg-transparent border-2 border-surface-border active:bg-surface-secondary',
  ghost:
    'bg-transparent active:bg-surface-secondary',
  danger:
    'bg-danger active:bg-red-600 shadow-sm shadow-red-500/20',
};

const variantTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-text-inverse',
  secondary: 'text-text',
  outline: 'text-text',
  ghost: 'text-text',
  danger: 'text-text-inverse',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 min-h-[36px]',
  md: 'px-6 py-3 min-h-[44px]',
  lg: 'px-8 py-4 min-h-[52px]',
};

const disabledVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-surface-muted active:bg-surface-muted',
  secondary: 'bg-surface-secondary active:bg-surface-secondary',
  outline: 'border-surface-border bg-surface-secondary active:bg-surface-secondary',
  ghost: 'bg-surface-secondary active:bg-surface-secondary',
  danger: 'bg-surface-muted active:bg-surface-muted',
};

const disabledTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-text-secondary',
  secondary: 'text-text-secondary',
  outline: 'text-text-secondary',
  ghost: 'text-text-secondary',
  danger: 'text-text-secondary',
};

const sizeTextClasses: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      className = '',
      onPress,
      ...props
    },
    ref
  ) => {
    const handlePress = useCallback(
      (e: Parameters<NonNullable<ComponentProps<typeof Pressable>['onPress']>>[0]) => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      },
      [disabled, loading, onPress]
    );

    const isDisabled = disabled || loading;
    const showDisabledStyle = disabled && !loading;
    const labelTextClass = showDisabledStyle
      ? disabledTextClasses[variant]
      : variantTextClasses[variant];

    return (
      <Pressable
        ref={ref}
        onPress={handlePress}
        disabled={isDisabled}
        className={`
          rounded-full flex-row items-center justify-center
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${showDisabledStyle ? disabledVariantClasses[variant] : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'danger'
                ? themeColors.text.inverse
                : themeColors.primary['500']
            }
          />
        ) : (
          <Text
            className={`font-sans-semibold ${labelTextClass} ${sizeTextClasses[size]}`}
          >
            {children}
          </Text>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
