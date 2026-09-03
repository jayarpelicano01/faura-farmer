/** Shared Faura-Farmer palette mirrored from packages/config/src/tokens.ts for Metro. */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#074A8F',
        'deep-navy': '#030B26',
        'ghost-white': '#F5F5FA',
        income: '#0f6e56',
        expense: '#12436F'
      },
      fontFamily: {
        body: ['AlbertSans'],
        display: ['Unbounded']
      },
    }
  }
};
