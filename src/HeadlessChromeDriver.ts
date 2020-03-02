import puppeteer, { Target } from "puppeteer"
import { ChildProcess } from "child_process";
import _ from "lodash"
import { EventEmitter } from 'events';
import { logger } from "./Logger"

export interface IHeadlessChromeDriver extends EventEmitter {
    jobLimitExceeded(): boolean;
    startJob(jobId:number);
    launch(): Promise<IHeadlessChromeDriver>;
    kill(): Promise<void>;
    clear(): Promise<void>;
    restart(): Promise<IHeadlessChromeDriver>;

    id: number;
    process: ChildProcess;
    wsEndpoint: string
}

export class HeadlessChromeDriver extends EventEmitter implements IHeadlessChromeDriver {
    readonly id: number
    private target: Target
    private startTime: Date
    private jobsCount: number
    private jobsLimit: number
    private browser: puppeteer.Browser
    wsEndpoint: string
    process: ChildProcess
    private jobTimeout: NodeJS.Timeout
    private launching: boolean


    constructor(id: number) {
        super()
        this.id = id
        this.jobsCount = 0
        this.jobsLimit = 30 + id
        this.launching = false
    }

    public jobLimitExceeded() {
        return this.jobsCount >= this.jobsLimit
    }

    public startJob(jobId:number) {
        this.jobsCount++
        logger.job_start(this.currentJob())
        this.jobTimeout = setTimeout(() => {
            this.emit("job_timeout", this)
            logger.job_timeout(this.toString());
        }, 30000)
    }

    private endJob() {
        this.jobTimeout && clearTimeout(this.jobTimeout)
        this.jobTimeout = null
        logger.job_end(this.currentJob())
        this.emit("job_end", this)
    }

    public async launch() {
        this.launching = true
        this.jobsCount = 0
        try {
            this.browser = await puppeteer.launch({
                args: ['--v1=1', '--disable-gpu',
                    '--disable-canvas-aa', // Disable antialiasing on 2d canvas
                    '--disable-2d-canvas-clip-aa', // Disable antialiasing on 2d canvas clips
                    '--disable-gl-drawing-for-tests', // BEST OPTION EVER! Disables GL drawing operations which produce pixel output. With this the GL output will not be correct but tests will run faster.
                    '--disable-dev-shm-usage', // ???
                    '--no-zygote', // wtf does that mean ?
                    '--use-gl=swiftshader', // better cpu usage with --use-gl=desktop rather than --use-gl=swiftshader, still needs more testing.
                    '--enable-webgl',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-first-run',
                    '--disable-infobars',
                    '--disable-breakpad',
                    '--window-size=1280,1024', // see defaultViewport
                    '--no-sandbox', // meh but better resource comsuption
                    '--disable-setuid-sandbox'],
                dumpio: false,
                handleSIGINT: true,
                handleSIGTERM: true,
                headless: true,
                ignoreHTTPSErrors: true
            });
            this.startTime = new Date()
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()

            this.browser.on("disconnected", () => {
                this.restart()
            });
            this.browser.on("targetchanged", (target) => {
                logger.debug(`${this.currentJob()} ${target.type()} changed`, target.url());
            });
            this.browser.on('targetcreated', async (target) => {
                if (!this.target && target.type() == "browser" && !this.launching) {
                    this.target = target
                }
                logger.debug(`${this.currentJob()} ${target.type()} created`, target.url())
            });
            this.browser.on('targetdestroyed', async (target) => {
                logger.debug(`${target.type()} closed`, target.url())
                if (this.target == target) {
                    this.target = null
                    this.endJob()
                }
            });
        } catch (e) {
            logger.error("issue launching browser", e)
        }
        logger.chrome_start(`[ID: ${this.id}] [PID: ${this.browser.process().pid}] [URL: ${this.wsEndpoint}]`)
        this.launching = false
        this.emit("launch", this)
        return this;
    }

    public async kill() {
        try {
            this.browser.removeAllListeners()
            await this.browser.close()
            this.process.kill();
        } catch (e) {
            logger.error("issue killing browser", e)
        }
    }

    public async clear() {
        logger.chrome_clear(this.currentJob());
        try {
            const pages = await this.browser.pages()
            const blankPage = await this.browser.newPage()
            await Promise.all(pages.map(async (page) => {
                try { if (page !== blankPage) await page.close() } catch{ }
            }));
            const client = await blankPage.target().createCDPSession()
            try { await client.send("Network.clearBrowserCache") } catch (e) { console.error(e) }
            try { await client.send("Network.clearBrowserCookies") } catch (e) { console.error(e) }
            const [bc, ...contexts] = this.browser.browserContexts();
            contexts.map(async c => { try { await c.close() } catch{ } })
        } catch (e) {
            logger.error("issue clearing browser.", e)
            await this.restart()
        }
    }

    public async restart() {
        try {
            logger.chrome_restart(this.currentJob())
            try { await this.kill() } catch{ };
            return await this.launch()
            
        } catch (e) {
            logger.error("issue restarting browser", e)
        }
    }

    currentID(){
        return `[ID: ${this.id}]`
    }
    currentJob() {
        return `[ID: ${this.id}]` + (this.jobsCount ? ` [job:${this.jobsCount}]` : '')
    }

}