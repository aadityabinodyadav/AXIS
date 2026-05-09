module.exports = function(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip Flow types early to avoid codegen parsing Flow in node_modules
      '@babel/plugin-transform-flow-strip-types',
    ],
  };
};
