const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const isProductionBundle = process.env.NODE_ENV === "production";

// Add SVG transformer support
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

const existingBlockList = config.resolver?.blockList;
const blockListPatterns = Array.isArray(existingBlockList)
  ? [...existingBlockList]
  : existingBlockList
    ? [existingBlockList]
    : [];

// Strip internal /dev/* studio routes from ALL production builds (iOS, Android, and Web).
if (isProductionBundle) {
  blockListPatterns.push(/[/\\]app[/\\]dev[/\\].*/);
}

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...config.resolver.sourceExts, "svg"],
  ...(blockListPatterns.length > 0 ? { blockList: blockListPatterns } : {}),
};

module.exports = withNativeWind(config, { input: "./global.css" });
