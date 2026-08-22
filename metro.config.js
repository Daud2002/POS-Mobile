const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Resolves the "@/*" -> "src/*" alias declared in tsconfig.json.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
