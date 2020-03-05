import http from "http";
import _ from "lodash"
import { timeout, IdGenerator } from "./utils";
import treeKill from "tree-kill";
import { IHeadlessChromeDriverFactory } from "./HeadlessChromeDriverFactory";
import { IHeadlessChromeDriver } from "./HeadlessChromeDriver";
import { IHttpProxy } from "./HttpProxy";
import { IHttpProxyFactory } from "./ProxyFactory";
import { IHttpServer } from "./HttpServer";
import { IHttpServerFactory } from "./HttpServerFactory";
import { logger } from "./Logger";

export class HeadLessChromeServer {
    readonly defaultPoolSize = 4;
    readonly poolSize: number;
    readonly httpProxy: IHttpProxy;
    readonly jobIdGenerator: IdGenerator

    idleBrowsers: IHeadlessChromeDriver[] = [];
    private httpServer: IHttpServer;
    runningProcesses: number[] = []
    readonly headlessChromeDriverFactory: IHeadlessChromeDriverFactory;

    constructor(chromeDriverFactory: IHeadlessChromeDriverFactory, proxyFactory: IHttpProxyFactory, httpServerFactory: IHttpServerFactory) {
        this.headlessChromeDriverFactory = chromeDriverFactory;
        this.poolSize = parseInt(process.env.POOL_SIZE) || this.defaultPoolSize;
        this.httpProxy = proxyFactory.createInstance();
        this.httpServer = httpServerFactory.createInstance().onUpgrade(this.handleRequest.bind(this));
        this.jobIdGenerator = new IdGenerator();
        this.initialize();
    }

    private logUncaughtException(err: Error) {
        console.error(err.stack);
    }

    private exitProcess() {
        process.removeListener("uncaughtException", this.logUncaughtException);

        this.killBrowsers();
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

    private async handleRequest(req: http.IncomingMessage, socket: any, head: any) {
        let instance = await this.getInstance();
        this.httpProxy.sendToInstance(instance, req, socket, head);
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
        await instance.clear();

        this.addIdleBrowser(instance);
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
