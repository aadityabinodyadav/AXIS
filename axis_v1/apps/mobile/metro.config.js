const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

const config = getDefaultConfig(projectRoot)

// Allow Metro to watch the workspace root and prefer the app's local node_modules.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(workspaceRoot, 'node_modules'),
]

// Prefer the mobile app's local package for runtime polyfills, fallback to workspace.
config.resolver.extraNodeModules = {
	'@ungap/structured-clone': path.resolve(projectRoot, 'node_modules', '@ungap', 'structured-clone'),
}

module.exports = config
