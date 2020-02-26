import http from "http";
import httpProxy from "http-proxy";
import _ from "lodash"
import { HeadlessChromeDriver } from "./HeadlessChromeDriver";
import { IdGenerator, timeout } from "./utils";
import treeKill from "tree-kill";

export class HeadLessChromeServer {
    poolSize:number;
    httpProxy: httpProxy;
    idleBrowsers: HeadlessChromeDriver[] = [];
    httpServer: http.Server;
    runningProcesses: number[] = []
    idGenerator: IdGenerator = new IdGenerator()

    constructor() {
        this.initialize()
    }

    private initialize(){
        this.poolSize = parseInt(process.env.POOL_SIZE) || 4
        this.initializeProxy();
        this.httpServer = this.createHttpServer();
        process.on('uncaughtException', function (err) {
            console.error(err.stack);
        });
        process.setMaxListeners(this.poolSize + 3 )
        process.once("exit", this.killBrowsers.bind(this))
    }

    private initializeProxy() {
        this.httpProxy = httpProxy.createProxyServer({ ws: true });
        this.httpProxy.on('error', (err: Error, _req, res) => {
            res.writeHead && res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Issue communicating with Chrome`);
        });
    }

    public async start(port = 3000) {
        for (let i = 0; i < this.poolSize; i++) {
            await this.createInstance()
        }
        await this.listen(port)
    }
    private createHttpServer(): http.Server {
        return http
            .createServer()
            .on('upgrade', async (req, socket, head) => {
                return await this.handleRequest(req, socket, head);
            })
    }
    private async handleRequest(req: http.IncomingMessage, socket: any, head: any) {
        let instance = await this.getInstance();
        this.httpProxy.ws(req, socket, head, { target: instance.wsEndpoint })
    }
    private listen(port: number) {
        let res = this.httpServer.listen(port);
        console.log(`server listening on port: ${port}`)
        return res;
    }

    private async createInstance() {
        let instance = new HeadlessChromeDriver(this.idGenerator.next())
        this.setupInstance(instance)
        await instance.launch();
    }
    private async getInstance(): Promise<HeadlessChromeDriver> {
        let instance = this.idleBrowsers.pop()
        while (!instance) {
            await timeout(200)
            instance = this.idleBrowsers.pop()
        }
        instance.startJob()
        return instance;
    }

    private setupInstance(instance: HeadlessChromeDriver) {
        instance.on("job_timeout", this.onInstanceJobTimeout.bind(this))
        instance.on("job_end", this.onInstanceEndJob.bind(this))
        instance.on("launch", this.onInstanceLaunch.bind(this))
    }
    private async onInstanceLaunch(instance: HeadlessChromeDriver) {
        this.addIdleBrowser(instance)
        this.addProcess(instance.process.pid)
    }
    private async onInstanceJobTimeout(instance: HeadlessChromeDriver) {
        await this.recycleInstance(instance)
    }
    private async onInstanceEndJob(instance: HeadlessChromeDriver) {
        await this.recycleInstance(instance)
    }

    private async recycleInstance(instance: HeadlessChromeDriver) {
        if (instance.jobLimitExceeded()) {
            instance.log("jobs limit exeeded")
            const oldPID = instance.process.pid
            instance = await instance.restart()
            this.runningProcesses = this.runningProcesses.filter(pid => pid != oldPID)
        }
        else {
            await instance.clear()
        }
        this.addIdleBrowser(instance)
    }
    private addProcess(pid: number) {
        this.runningProcesses.push(pid);
    }

    private addIdleBrowser(chromeDriver: HeadlessChromeDriver) {
        this.idleBrowsers.push(chromeDriver)
    }

    private killBrowsers() {
        this.runningProcesses.map(pid => treeKill(pid))
    }

}
