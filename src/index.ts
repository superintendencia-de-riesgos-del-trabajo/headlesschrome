import { HeadLessChromeServer } from "./HeadlessChromeServer"
import { HeadlessChromeDriverFactory } from "./HeadlessChromeDriverFactory";

(async () => {
  const server = new HeadLessChromeServer(new HeadlessChromeDriverFactory());
  await server.start();
})();