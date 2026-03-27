const React = require('react');

const createComponent = (name) => {
  const Component = React.forwardRef((props, ref) =>
    React.createElement('View', { ...props, ref, testID: props.testID || name }),
  );
  Component.displayName = name;
  return Component;
};

module.exports = {
  __esModule: true,
  default: createComponent('Svg'),
  Svg: createComponent('Svg'),
  Circle: createComponent('Circle'),
  Rect: createComponent('Rect'),
  Path: createComponent('Path'),
  Line: createComponent('Line'),
  G: createComponent('G'),
  Defs: createComponent('Defs'),
  LinearGradient: createComponent('SvgLinearGradient'),
  Stop: createComponent('Stop'),
  Text: createComponent('SvgText'),
  TSpan: createComponent('TSpan'),
  ClipPath: createComponent('ClipPath'),
  Mask: createComponent('Mask'),
  Use: createComponent('Use'),
  Symbol: createComponent('Symbol'),
  Polygon: createComponent('Polygon'),
  Polyline: createComponent('Polyline'),
  Ellipse: createComponent('Ellipse'),
};
