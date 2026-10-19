// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Allow Metro to recognize and bundle .wasm files (required for expo-sqlite on web)
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// 2. Custom resolver for subpath imports in react-native-web and inline-style-prefixer
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix extensionless subpath imports from inline-style-prefixer
  if (moduleName.startsWith('inline-style-prefixer/lib/') && !moduleName.endsWith('.js')) {
    moduleName = moduleName + '.js';
  }

  // Fix extensionless import from react-native-web/dist/index
  if (moduleName === 'react-native-web/dist/index') {
    moduleName = 'react-native-web/dist/index.js';
  }

  if (typeof originalResolveRequest === 'function') {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
