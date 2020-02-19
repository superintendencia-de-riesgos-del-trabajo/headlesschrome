import { HeadLessChromeServer } from "./headlesschrome-server"

(async () => {
  const server = new HeadLessChromeServer();
  await server.launch();
  server.listen(3000);
})();