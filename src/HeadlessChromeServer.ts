import http from "http";
import _ from "lodash"
import { timeout, IdGenerator } from "./utils";
import treeKill from "tree-kill";
import { IHeadlessChromeDriverFactory } from "./HeadlessChromeDriverFactory";
import { IHeadlessChromeDriver } from "./HeadlessChromeDriver";
import { IHttpProxy } from "./HttpProxy";
import { IHttpProxyFactory } from "./ProxyFactory";
import { IHttpServer, HttpClientRequest } from "./HttpServer";
import { IHttpServerFactory } from "./HttpServerFactory";
import { Socket } from "net";
import puppeteer from "puppeteer"
import handlebars from "handlebars";

export class HeadLessChromeServer {
    static readonly defaultPoolSize = 1;
    readonly poolSize: number;
    readonly httpProxy: IHttpProxy;
    readonly jobIdGenerator: IdGenerator

    idleBrowsers: IHeadlessChromeDriver[] = [];
    private httpServer: IHttpServer;
    runningProcesses: number[] = []
    readonly headlessChromeDriverFactory: IHeadlessChromeDriverFactory;


    constructor(chromeDriverFactory: IHeadlessChromeDriverFactory, proxyFactory: IHttpProxyFactory, httpServerFactory: IHttpServerFactory) {
        this.headlessChromeDriverFactory = chromeDriverFactory;
        this.poolSize = parseInt(process.env.POOL_SIZE) || HeadLessChromeServer.defaultPoolSize;
        this.httpProxy = proxyFactory.createInstance();
        this.httpServer = httpServerFactory.createInstance()
            .addUpgradeListener(this.handleUpgrade.bind(this))
            .addRequestListener("POST", "/pdf", this.handlePdfRequest.bind(this));
        this.jobIdGenerator = new IdGenerator();
        this.initialize();
    }

    private logUncaughtException(err: Error) {
        console.error(err.stack);
    }

    private async exitProcess() {
        process.removeListener("uncaughtException", this.logUncaughtException);

        await this.killBrowsers();
    }

    private initialize() {
        process.on('uncaughtException', this.logUncaughtException.bind(this));
        process.once("exit", this.exitProcess.bind(this));
    }

    public async start(port = 3000) {
        for (let i = 0; i < this.poolSize; i++) {
            await this.createInstance();
        }
        this.httpServer.start(port);
    }

    public async stop() {
        this.httpServer.stop();
    }

    private async handleUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        let instance = await this.getInstance();
        this.httpProxy.sendToInstance(instance, req, socket, head);
    }


    private async handlePdfRequest(req: HttpClientRequest, res: http.ServerResponse) {
        try{
            let instance = await this.getInstance();
            var browser = await puppeteer.connect({ browserWSEndpoint: instance.wsEndpoint });
            var pages = (await browser.pages())
            var page = (pages.length && pages[0]) || await browser.newPage();
            await page.emulateMediaType("print")
            const template = handlebars.compile(req.body.Html)
            const content = template(req.body.Data)
            await page.setContent(content)
            const data = await page.pdf({ format: 'A4' })
            res.writeHead(200, { 'Content-Type': 'application/pdf' })
            res.write(data)
            try{ await browser.disconnect(); }catch{}
        }catch{
            res.writeHead(500,"error al generar el pdf")            
        }
    }

    private async createInstance() {
        process.setMaxListeners(process.getMaxListeners() + 3);
        let instance = this.headlessChromeDriverFactory.createInstance();
        this.setupInstance(instance);
        await instance.launch();
    }

    private async getInstance(): Promise<IHeadlessChromeDriver> {
        let instance = this.idleBrowsers.pop();

        while (!instance) {
            await timeout(200)
            instance = this.idleBrowsers.pop();
        }

        instance.startJob(this.jobIdGenerator.next());
        return instance;
    }

    private setupInstance(instance: IHeadlessChromeDriver) {
        instance.on("job_timeout", this.onInstanceJobTimeout.bind(this));
        instance.on("job_end", this.onInstanceEndJob.bind(this));
        instance.on("launch", this.onInstanceLaunch.bind(this));
        instance.on("death", this.onInstanceDeath.bind(this));
        instance.on("job_limit_exceeded", this.onInstanceDeath.bind(this));
    }

    private async onInstanceDeath(instance: IHeadlessChromeDriver) {
        const oldPID = instance.process.pid;
        this.runningProcesses = this.runningProcesses.filter(pid => pid != oldPID);
        await instance.kill();
        this.createInstance();
    }

    private async onInstanceLaunch(instance: IHeadlessChromeDriver) {
        this.addIdleBrowser(instance);
        this.addProcess(instance.process.pid);
    }

    private async onInstanceJobTimeout(instance: IHeadlessChromeDriver) {
        await this.recycleInstance(instance);
    }

    private async onInstanceEndJob(instance: IHeadlessChromeDriver) {
        await this.recycleInstance(instance);
    }

    private async recycleInstance(instance: IHeadlessChromeDriver) {
        if (!instance.disposed) {
            await instance.clear();
            this.addIdleBrowser(instance);
        }
    }

    private addProcess(pid: number) {
        this.runningProcesses.push(pid);
    }

    private addIdleBrowser(chromeDriver: IHeadlessChromeDriver) {
        if (chromeDriver != null) {
            this.idleBrowsers.push(chromeDriver);
        }
    }

    private async killBrowsers() {
        await Promise.all(this.idleBrowsers.map(browser => browser.kill()));
        this.runningProcesses.map(pid => { try { treeKill(pid) } catch{ } });
    }
}
