import http from "http";
import httpProxy from "http-proxy";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";
import treekill from "tree-kill";
import _ from "lodash"


export class HeadLessChromeServer {
    poolSize = 4;
    proxy: httpProxy;
    chromeInstances: Browser[] = [];
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

        // this.proxy.on("proxyRes",console.log)
        // this.proxy.on("error",console.log)
        // this.proxy.on("proxyRes",console.log)
        this.proxy.on('close', function (res, socket, head) {
            console.log(`ws closed: ${res.statusCode}`);
        });
    }

    async start() {

        for (let i = 0; i < this.poolSize; i++) {
            this.chromeInstances.push(await this.createInstance());
        }

    }
    async killBrowser(browser){
        console.log("killing PID ",browser.process().pid)
        browser.removeAllListeners()
        await browser.close().catch(() => { })
        treekill(browser.process().pid, "SIGKILL")
    }

    async createInstance() {
        let browser = await puppeteer.launch({
            args: ['--no-sandbox', '--enable-logging', '--v1=1', '--disable-setuid-sandbox', '--disable-gpu'],
            dumpio: true,
            handleSIGINT: true,
            handleSIGTERM: true,
            headless: true,
            ignoreDefaultArgs: ['--disable-extensions'],
            ignoreHTTPSErrors: false
        }); 

        process.once("exit", async ()=>{
            await this.killBrowser(browser)
        })
        browser.process().once("exit", async () => {
            await this.relaunchInstance(browser);
        })
        // var pages = await browser.pages();
        // pages.forEach(this.setupPage.bind(this))
        browser.on("disconnected", () => {
            console.log('browser disconnected')
            this.clearInstanceAndRelease(browser)
        });
        browser.on("targetchanged", (target) => {
            console.log('target changed',`${target.url()}${target.type()}`);
        });
        browser.on('targetcreated', async (target) => {
            if (target)
                console.log(` target created: ${target.url()}${target.type()}`)
        });
        browser.on('targetdestroyed', async (target) => {
            console.log(` target destroyed: ${target.url()}${target.type()}`)
            if(target.type() == "browser"){
                this.clearInstanceAndRelease(browser);
            }
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
        treekill(browser.process().pid, "SIGKILL")
        this.chromeInstances.push(await this.createInstance());
    }
    async clearInstanceAndRelease(browser: Browser) {
        console.log("reutilizando chrome");
        const [blank, ...pages] = await browser.pages();
        pages.forEach((page) => page.close());
        this.chromeInstances.push(browser);
    }

    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getInstance(): Promise<Browser> {
        let instance = this.chromeInstances.pop()
        while (!instance) {
           await this.timeout(200)
           instance = this.chromeInstances.pop()
        }
        return instance;
    }

    async handleRequest(req: http.IncomingMessage, socket: any, head: any) {
        console.log(`-------------------------------------------------`)

        console.log(`${new Date().toISOString()} - REQUEST`);
        let browser = await this.getInstance();
        console.log('proxyfing to:', browser.process().pid,browser.wsEndpoint())
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