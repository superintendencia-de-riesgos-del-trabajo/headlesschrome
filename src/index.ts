import { HeadLessChromeServer } from "./HeadlessChromeServer"

(async () => {
  const server = new HeadLessChromeServer();
  await server.start();
  server.listen(3000);
})();