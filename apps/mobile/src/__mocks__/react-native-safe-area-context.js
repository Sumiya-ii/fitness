const React = require('react');

const SafeAreaView = React.forwardRef((props, ref) =>
  React.createElement('View', { ...props, ref }),
);

module.exports = {
  SafeAreaView,
  SafeAreaProvider: ({ children }) => React.createElement('View', null, children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
};
