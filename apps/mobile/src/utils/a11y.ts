/**
 * Accessibility helper functions for screen readers and assistive technologies.
 * Use these to ensure consistent a11y labels across the app.
 */

export function a11yLabel(label: string) {
  return { accessibilityLabel: label };
}

export function a11yButton(label: string) {
  return {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
  };
}

export function a11yHeader(label: string) {
  return {
    accessibilityRole: 'header' as const,
    accessibilityLabel: label,
  };
}

export function a11yProgress(label: string, value: number, max: number) {
  return {
    accessibilityRole: 'progressbar' as const,
    accessibilityLabel: label,
    accessibilityValue: {
      min: 0,
      max,
      now: value,
      text: `${Math.round((value / max) * 100)}%`,
    },
  };
}
