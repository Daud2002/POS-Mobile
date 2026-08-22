module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Must be listed last. Reanimated 4 ships its worklets plugin here.
      'react-native-worklets/plugin',
    ],
  };
};
