const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const upstreamGetTransformOptions = config.transformer.getTransformOptions.bind(config.transformer);
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => {
    const upstream = await upstreamGetTransformOptions();
    return {
      ...upstream,
      transform: {
        ...upstream.transform,
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    };
  },
};

module.exports = config;
