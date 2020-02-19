import http from "http";
import httpProxy from "http-proxy";
import puppeteer from "puppeteer";
import { Browser } from "puppeteer";

export class HeadLessChromeServer {
    poolSize = 4;
    proxy:httpProxy;
    availableInstances:Browser[] = [];
    server: http.Server;

    constructor() {
        this.proxy = httpProxy.createProxyServer({ ws: true });
        this.server = this.createServer();
    }

    async launch() {
        for (let i = 0; i < this.poolSize; i++) {
            let browser = await puppeteer.launch({
                args: ['--no-sandbox', '--enable-logging', '--v1=1','--disable-setuid-sandbox','--disable-gpu'],
                handleSIGINT: false,
                handleSIGTERM: false,
                headless: true,
                ignoreDefaultArgs: ['--disable-extensions'],
                ignoreHTTPSErrors: false,
            });
            browser.on('disconnected', () => this.clearInstanceAndRelease(browser));
            console.log(`chrome instance: ${browser.process().pid} - ${browser.wsEndpoint()}`)
            this.availableInstances.push(browser);
        }

    }

    async clearInstanceAndRelease(browser: Browser) {
        console.log(`liberando instancia ${browser.wsEndpoint()}`);
        (await browser.pages()).map(p => p.close())
        this.availableInstances.push(browser);
    }

    async getInstance(): Promise<Browser> {
        let instance = undefined
        while (!instance) {
            instance = this.availableInstances.pop();
        }
        return instance;
    }

    async handleRequest(req:http.IncomingMessage, socket:any, head:any) {
        console.log(`${Date.now()} - REQUEST: ${req.url}`);
        let browser = await this.getInstance();
        try {
            this.proxy.ws(req, socket, head, { target: browser.wsEndpoint() })
        }catch(error){
            console.log(error);            
        }
    }

    createServer(): http.Server {
        return http
        .createServer()
        .on('upgrade', async(req, socket, head) => {
            await this.handleRequest(req,socket,head);
        })
    }
    
    listen(port:number){
        let res = this.server.listen(port);
        console.log(`server listening on port: ${port}`)
        return res;
    }

}