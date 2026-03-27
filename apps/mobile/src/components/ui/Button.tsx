import * as Haptics from 'expo-haptics';
import { type ComponentProps, forwardRef, useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { themeColors } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white active:bg-zinc-200',
  secondary: 'bg-surface-default active:bg-surface-secondary border border-surface-border',
  outline: 'bg-transparent border-2 border-surface-border active:bg-surface-secondary',
  ghost: 'bg-transparent active:bg-surface-secondary',
  danger: 'bg-danger active:bg-red-700',
};

const variantTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-black',
  secondary: 'text-text',
  outline: 'text-text',
  ghost: 'text-text',
  danger: 'text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 min-h-[44px]',
  md: 'px-6 py-3 min-h-[44px]',
  lg: 'px-8 py-4 min-h-[52px]',
};

const disabledVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-surface-tertiary active:bg-surface-tertiary',
  secondary: 'bg-surface-secondary active:bg-surface-secondary',
  outline: 'border-surface-border bg-surface-secondary active:bg-surface-secondary',
  ghost: 'bg-surface-secondary active:bg-surface-secondary',
  danger: 'bg-surface-tertiary active:bg-surface-tertiary',
};

const disabledTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-text-secondary',
  secondary: 'text-text-secondary',
  outline: 'text-text-secondary',
  ghost: 'text-text-secondary',
  danger: 'text-text-secondary',
};

const sizeTextClasses: Record<ButtonSize, string> = {
  sm: 'text-sm leading-5',
  md: 'text-base leading-6',
  lg: 'text-lg leading-7',
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
    ref,
  ) => {
    const handlePress = useCallback(
      (e: Parameters<NonNullable<ComponentProps<typeof Pressable>['onPress']>>[0]) => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      },
      [disabled, loading, onPress],
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
          rounded-2xl flex-row items-center justify-center
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
            className={`font-sans-semibold text-center ${labelTextClass} ${sizeTextClasses[size]}`}
          >
            {children}
          </Text>
        )}
      </Pressable>
    );
  },
);

Button.displayName = 'Button';
