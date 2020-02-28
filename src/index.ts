import { HeadLessChromeServer } from "./HeadlessChromeServer"
import { HeadlessChromeDriverFactory } from "./HeadlessChromeDriverFactory";
import { HttpProxyFactory } from "./ProxyFactory";
import { HttpServerFactory } from "./HttpServerFactory";

(async () => {
  const server = new HeadLessChromeServer(new HeadlessChromeDriverFactory(), new HttpProxyFactory(), new HttpServerFactory());
  await server.start();
})();