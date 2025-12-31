const {join} = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
};
