const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Expo watches the monorepo root. Next continuously creates and removes this
// generated directory while developing the web app, so Metro must never crawl it.
const webNextPattern = path
  .resolve(__dirname, '../web/.next')
  .split(path.sep)
  .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[/\\\\]');

const existingBlockList = config.resolver.blockList
  ? (Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList])
  : [];

config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`^${webNextPattern}[/\\\\].*$`),
];

module.exports = withNativeWind(config, { input: './global.css' });
