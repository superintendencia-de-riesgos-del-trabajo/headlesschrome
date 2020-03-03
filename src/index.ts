import { HeadLessChromeServer } from "./HeadlessChromeServer"
import { HeadlessChromeDriverFactory } from "./HeadlessChromeDriverFactory";
import { HttpProxyFactory } from "./ProxyFactory";
import { HttpServerFactory } from "./HttpServerFactory";
import { BrowserFactory } from "./BrowserFactory";

(async () => {
  const server = new HeadLessChromeServer(new HeadlessChromeDriverFactory(new BrowserFactory()), new HttpProxyFactory(), new HttpServerFactory());
  await server.start();
})();