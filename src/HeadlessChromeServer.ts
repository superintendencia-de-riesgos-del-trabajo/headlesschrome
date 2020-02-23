import http from "http";
import httpProxy from "http-proxy";
import _ from "lodash"
import { HeadlessChromeDriver } from "./HeadLessChromeDriver";
import { IdGenerator, timeout } from "./utils";

export class HeadLessChromeServer {
    poolSize = 5;
    httpProxy: httpProxy;
    idleBrowsers: HeadlessChromeDriver[] = [];
    httpServer: http.Server;

    constructor() {
        this.initializeProxy();
        this.httpServer = this.createServer();
    }

    initializeProxy() {
        this.httpProxy = httpProxy.createProxyServer({ ws: true });
        this.httpProxy.on('error', (err: Error, _req, res) => {
            res.writeHead && res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Issue communicating with Chrome`);
        });
    }

    async start() {
        let idGen = new IdGenerator()
        for (let i = 0; i < this.poolSize; i++) {
            let drv = new HeadlessChromeDriver(this,idGen)
            await drv.launch();
        }
    }

    addIdleBrowser(chromeDriver:HeadlessChromeDriver){
        this.idleBrowsers.push(chromeDriver)
    }

    async getInstance(): Promise<HeadlessChromeDriver> {
        let instance = this.idleBrowsers.pop()
        while (!instance) {
            await timeout(200)
            instance = this.idleBrowsers.pop()
        }
        return instance;
    }

    async handleRequest(req: http.IncomingMessage, socket: any, head: any) {
        let instance = await this.getInstance();
        this.httpProxy.ws(req, socket, head, { target: instance.wsEndpoint })
    }

    createServer(): http.Server {
        return http
            .createServer()
            .on('upgrade', async (req, socket, head) => {
                return await this.handleRequest(req, socket, head);
            })
    }

    listen(port: number) {
        let res = this.httpServer.listen(port);
        console.log(`server listening on port: ${port}`)
        return res;
    }

}