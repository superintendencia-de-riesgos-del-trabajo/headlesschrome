import { HeadLessChromeServer } from "./headlesschrome-server"

(async () => {
  const server = new HeadLessChromeServer();
  await server.start();
  server.listen(3000);
})();