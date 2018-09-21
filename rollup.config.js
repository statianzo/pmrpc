const typescript = require('rollup-plugin-typescript2');
const pkg = require('./package.json');

export default {
  input: 'src/index.ts',
  output: [{file: pkg.main, format: 'cjs'}, {file: pkg.module, format: 'es'}],
  plugins: [
    typescript({
      tsConfigOverride: {
        compilerOptions: {
          declaration: true,
          allowJs: false,
        },
      },
    }),
  ],
};
