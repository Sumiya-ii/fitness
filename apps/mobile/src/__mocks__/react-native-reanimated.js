const React = require('react');

const createAnimatedComponent = (name) =>
  React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }));

const Animated = {
  View: createAnimatedComponent('View'),
  Text: createAnimatedComponent('Text'),
  ScrollView: createAnimatedComponent('ScrollView'),
  createAnimatedComponent: (Component) =>
    React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref })),
};

const noopLayout = { duration: () => noopLayout, delay: () => noopLayout };

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedProps: (fn) => fn(),
  useAnimatedStyle: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn() }),
  withSpring: (val) => val,
  withTiming: (val) => val,
  withDelay: (_, val) => val,
  withSequence: (...vals) => vals[vals.length - 1],
  FadeInDown: noopLayout,
  FadeIn: noopLayout,
  FadeOut: noopLayout,
  SlideInRight: noopLayout,
  Easing: { bezier: () => ({}) },
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};
