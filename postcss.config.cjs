const path = require('path');

const config = {
  plugins: {
    [require.resolve('postcss-import')]: {},
    [require.resolve('@tailwindcss/postcss')]: {},
  },
};

module.exports = config;
