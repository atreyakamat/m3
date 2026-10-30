// Metro config for the standalone Expo app that consumes the shared package
// from source outside its own folder. We add the repo root to watchFolders and
// let Metro resolve node_modules from both locations.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot, path.resolve(repoRoot, 'packages/shared')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
