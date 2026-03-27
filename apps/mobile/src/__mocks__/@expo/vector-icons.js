const React = require('react');

function createIconComponent(name) {
  const Icon = (props) =>
    React.createElement(
      'Text',
      { testID: props.testID, accessibilityLabel: props.name },
      props.name,
    );
  Icon.displayName = name;
  Icon.glyphMap = new Proxy({}, { get: (_, key) => key });
  return Icon;
}

module.exports = {
  Ionicons: createIconComponent('Ionicons'),
  MaterialIcons: createIconComponent('MaterialIcons'),
  FontAwesome: createIconComponent('FontAwesome'),
  Feather: createIconComponent('Feather'),
};
