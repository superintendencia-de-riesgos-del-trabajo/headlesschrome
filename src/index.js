const http = require('http');
const httpProxy = require('http-proxy');
const puppeteer = require('puppeteer');
const createServer = async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--enable-logging', '--v1=1'],
    handleSIGINT: false,
    handleSIGTERM: false,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    ignoreHTTPSErrors: false,
  });
  const target = browser.wsEndpoint();
  console.log(target);
  return new httpProxy.createProxyServer({ ws: true, target });

}

createServer().then(
  (server) => server.listen(3000), console.log);

