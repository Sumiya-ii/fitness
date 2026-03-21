import { a11yLabel, a11yButton, a11yHeader, a11yProgress } from '../utils/a11y';

describe('a11yLabel', () => {
  it('returns accessibilityLabel', () => {
    expect(a11yLabel('Email')).toEqual({ accessibilityLabel: 'Email' });
  });
});

describe('a11yButton', () => {
  it('returns button role and label', () => {
    expect(a11yButton('Submit')).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Submit',
    });
  });
});

describe('a11yHeader', () => {
  it('returns header role and label', () => {
    expect(a11yHeader('Profile')).toEqual({
      accessibilityRole: 'header',
      accessibilityLabel: 'Profile',
    });
  });
});

describe('a11yProgress', () => {
  it('returns progressbar role with correct percentage text', () => {
    const result = a11yProgress('Loading', 50, 200);
    expect(result.accessibilityRole).toBe('progressbar');
    expect(result.accessibilityLabel).toBe('Loading');
    expect(result.accessibilityValue.min).toBe(0);
    expect(result.accessibilityValue.max).toBe(200);
    expect(result.accessibilityValue.now).toBe(50);
    expect(result.accessibilityValue.text).toBe('25%');
  });

  it('rounds percentage text', () => {
    const result = a11yProgress('Progress', 1, 3);
    expect(result.accessibilityValue.text).toBe('33%');
  });

  it('reports 100% when complete', () => {
    const result = a11yProgress('Done', 5, 5);
    expect(result.accessibilityValue.text).toBe('100%');
  });

  it('reports 0% at start', () => {
    const result = a11yProgress('Start', 0, 10);
    expect(result.accessibilityValue.text).toBe('0%');
  });
});
