import http from "http";
import httpProxy from "http-proxy";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";
import treekill from "treekill";
import _ from "lodash";

export class HeadLessChromeServer {
    poolSize = 4;
    proxy: httpProxy;
    availableInstances: Browser[] = [];
    server: http.Server;

    constructor() {
        this.initializeProxy();
        this.server = this.createServer();
    }

    initializeProxy() {
        this.proxy = httpProxy.createProxyServer({ ws: true });
        this.proxy.on('error', (err: Error, _req, res) => {
            res.writeHead && res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Issue communicating with Chrome`);
        });
        this.proxy.on('proxyReqWs', (
            proxyReq: http.ClientRequest,
            req: http.IncomingMessage) => {
            // listen for messages coming FROM the target here
            console.log(`ws opened`)
        });
        //
        // Listen for the `close` event on `proxy`.
        //
        this.proxy.on('close', function (res, socket, head) {
            // view disconnected websocket connections
            console.log(`ws closed: ${res.statusCode}`);
        });
    }

    async start() {

        for (let i = 0; i < this.poolSize; i++) {
            this.availableInstances.push(await this.createInstance());
        }

    }

    async createInstance() {
        let browser = await puppeteer.launch({
            args: ['--no-sandbox', '--enable-logging', '--v1=1', '--disable-setuid-sandbox', '--disable-gpu'],
            dumpio: true,
            handleSIGINT: false,
            handleSIGTERM: false,
            headless: true,
            ignoreDefaultArgs: ['--disable-extensions'],
            ignoreHTTPSErrors: false
        });
        browser.process().once("exit", async () => {
            await this.relaunchInstance(browser);
        })
        // var pages = await browser.pages();
        // pages.forEach(this.setupPage.bind(this))
        browser.on("disconnected", () => {
            console.log('browser disconnected')
            this.relaunchInstance(browser)
        });
        browser.on('targetcreated', async (target) => {
            if (target)
                console.log(` target created: ${target.url()}${target.type()}`)
        });
        browser.on('targetdestroyed', async (target) => {
            console.log(` target destroyed: ${target.url()}${target.type()}`)
        });

        console.log(`chrome instance: ${browser.process().pid} - ${browser.wsEndpoint()}`)
        return browser;
    }
    // async setupPage(p) {
    //     const client = _.get(p, '_client', _.noop);
    //     await client.send('Debugger.enable');
    //     await client.send('Debugger.pause');

    // }
    async relaunchInstance(browser) {
        console.log("relanzando chrome")
        browser.removeAllListeners()
        browser.close().catch(() => { })
        try {
            treekill(browser.process().pid, "SIGKILL")
        } catch{ }
        this.availableInstances.push(await this.createInstance());
    }
    async clearInstanceAndRelease(browser: Browser) {
        console.log("reutilizando chrome");
        const pages = await browser.pages();
        pages.forEach((page) => page.close());
        this.availableInstances.push(browser);
    }

    async getInstance(): Promise<Browser> {
        let instance = undefined
        while (!instance) {
            instance = this.availableInstances.pop();
        }
        return instance;
    }

    async handleRequest(req: http.IncomingMessage, socket: any, head: any) {
        console.log(`${Date.now()} - REQUEST`);
        let browser = await this.getInstance();

        this.proxy.ws(req, socket, head, { target: browser.wsEndpoint() })
    }

    createServer(): http.Server {
        return http
            .createServer()
            .on('upgrade', async (req, socket, head) => {
                return await this.handleRequest(req, socket, head);
            })
    }

    listen(port: number) {
        let res = this.server.listen(port);
        console.log(`server listening on port: ${port}`)
        return res;
    }

}