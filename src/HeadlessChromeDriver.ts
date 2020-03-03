import puppeteer, { Target } from "puppeteer"
import { ChildProcess } from "child_process";
import _ from "lodash"
import { EventEmitter } from 'events';
import { logger } from "./Logger"
import { IJob, Job } from "./Job";

export interface IHeadlessChromeDriver extends EventEmitter {
    jobLimitExceeded(): boolean;
    startJob(jobId: number): IJob;
    endJob(): IJob;
    getCurrentJob(): IJob;
    launch(): Promise<IHeadlessChromeDriver>;
    kill(): Promise<void>;
    clear(): Promise<void>;
    restart(): Promise<IHeadlessChromeDriver>;

    id: number;
    process: ChildProcess;
    wsEndpoint: string;
    defaultJobLimit: number;
    defaultJobTimeout: number;
    jobsLimit: number;
    jobsTimeout: number;
}

export class HeadlessChromeDriver extends EventEmitter implements IHeadlessChromeDriver {
    readonly defaultJobLimit: number = 30;
    readonly defaultJobTimeout: number = 30;
    readonly id: number;
    private target: Target;
    private jobsCount: number;
    readonly jobsLimit: number;
    readonly jobsTimeout: number;
    private browser: puppeteer.Browser;
    wsEndpoint: string;
    process: ChildProcess;
    private jobTimeout: NodeJS.Timeout;
    private launching: boolean;
    private currentJob: IJob;

    constructor(id: number) {
        super()
        this.id = id
        this.jobsCount = 0
        this.jobsLimit = (parseInt(process.env.INSTANCE_JOB_LIMIT) || this.defaultJobLimit) + id
        this.jobsTimeout = (parseInt(process.env.INSTANCE_JOB_TIMEOUT) || this.defaultJobTimeout) * 1000;
        this.launching = false
    }

    public jobLimitExceeded() {
        return this.jobsCount >= this.jobsLimit
    }

    public startJob(jobId: number) {
        
        if (this.jobTimeout != null) {
            const errMsg = "cannot start a new job until the previous has finished"
            logger.error(errMsg);
            throw new Error(errMsg);
        }
        
        this.currentJob =  new Job(jobId);
        this.jobsCount++
        logger.job_start(this.currentJobLog())
        this.jobTimeout = setTimeout(() => {
            this.jobTimeout = null
            logger.job_timeout(this.currentJobLog());
            this.emit("job_timeout", this)
        }, this.jobsTimeout);

        return this.currentJob;
    }

    public endJob(url = null) {
        this.clearJobTimeout();
        logger.job_end(this.currentJobLog(), url)
        this.emit("job_end", this)

        return this.currentJob;
    }

    public getCurrentJob(){
        return this.currentJob;
    }

    private clearJobTimeout() {
        this.jobTimeout && clearTimeout(this.jobTimeout)
        this.jobTimeout = null
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
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()

            this.browser.on("disconnected", () => {
                this.restart()
            });
            this.browser.on("targetchanged", (target) => {
                if (target.type() == 'page') logger.nav(this.currentJobLog(), target.url())
            });
            this.browser.on('targetcreated', async (target) => {
                if (!this.target && target.type() == "browser" && !this.launching) {
                    this.target = target
                }
            });
            this.browser.on('targetdestroyed', async (target) => {
                if (this.target == target) {
                    const url = target.url()
                    this.target = null
                    this.endJob(url)
                }
            });
        } catch (e) {
            logger.error("issue launching browser", e)
        }
        logger.chrome_start(this.currentBrowserLog())
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
        logger.chrome_clear(this.currentJobLog());
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
            this.clearJobTimeout();
            logger.chrome_restart(this.currentJobLog())
            try { await this.kill() } catch { };
            return await this.launch()

        } catch (e) {
            logger.error("issue restarting browser", e)
        }
    }

    currentIdLog() {
        return `[CHROME: ${this.id}]`.padEnd(8, ' ');
    }
    currentJobLog() {
        return `${this.currentIdLog()}` + (this.jobsCount ? ` ${this.currentJob.jobLog()}` : '')
    }
    currentBrowserLog() {
        return `${this.currentIdLog()}` + ` [PID: ${this.browser.process().pid}]`.padEnd(13, ' ') + ` [URL: ${this.wsEndpoint}]`
    }

}