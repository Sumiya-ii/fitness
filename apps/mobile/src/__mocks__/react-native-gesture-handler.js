const React = require('react');

const GestureDetector = ({ children }) => children;
const Gesture = {
  Pan: () => ({
    onUpdate: () => Gesture.Pan(),
    onEnd: () => Gesture.Pan(),
    onStart: () => Gesture.Pan(),
    onFinalize: () => Gesture.Pan(),
    onChange: () => Gesture.Pan(),
    minDistance: () => Gesture.Pan(),
    activeOffsetX: () => Gesture.Pan(),
    activeOffsetY: () => Gesture.Pan(),
    failOffsetX: () => Gesture.Pan(),
    failOffsetY: () => Gesture.Pan(),
    enabled: () => Gesture.Pan(),
  }),
  Tap: () => ({
    onEnd: () => Gesture.Tap(),
    onStart: () => Gesture.Tap(),
    numberOfTaps: () => Gesture.Tap(),
    maxDuration: () => Gesture.Tap(),
    enabled: () => Gesture.Tap(),
  }),
  Simultaneous: (..._gestures) => ({}),
  Exclusive: (..._gestures) => ({}),
  Race: (..._gestures) => ({}),
};

const GestureHandlerRootView = ({ children, ...props }) =>
  React.createElement('View', props, children);

module.exports = {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
  Directions: {},
  State: {
    UNDETERMINED: 0,
    FAILED: 1,
    BEGAN: 2,
    CANCELLED: 3,
    ACTIVE: 4,
    END: 5,
  },
  PanGestureHandler: ({ children }) => children,
  TapGestureHandler: ({ children }) => children,
  ScrollView: React.forwardRef((props, ref) =>
    React.createElement('ScrollView', { ...props, ref }),
  ),
  FlatList: React.forwardRef((props, ref) => React.createElement('FlatList', { ...props, ref })),
};
