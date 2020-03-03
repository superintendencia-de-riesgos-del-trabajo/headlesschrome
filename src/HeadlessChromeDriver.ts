import puppeteer, { Target } from "puppeteer"
import { ChildProcess } from "child_process";
import _ from "lodash"
import { EventEmitter } from 'events';
import { logger } from "./Logger"

export interface IHeadlessChromeDriver extends EventEmitter {
    jobLimitExceeded(): boolean;
    startJob(jobId: number);
    endJob();
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
    private currentJobId: number;

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
        this.currentJobId = jobId
        if (this.jobTimeout != null) {
            const errMsg = "cannot start a new job until the previous has finished"
            logger.error(errMsg);
            throw new Error(errMsg);
        }

        this.jobsCount++
        logger.job_start(this.currentJob())
        this.jobTimeout = setTimeout(() => {
            this.jobTimeout = null
            logger.job_timeout(this.currentJob());
            this.emit("job_timeout", this)
        }, this.jobsTimeout);
    }

    public endJob(url = null) {
        this.jobTimeout && clearTimeout(this.jobTimeout)
        this.jobTimeout = null
        logger.job_end(this.currentJob(), url)
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
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()

            this.browser.on("disconnected", () => {
                this.restart()
            });
            this.browser.on("targetchanged", (target) => {
                if (target.type() == 'page') logger.nav(this.currentJob(), target.url())
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
        logger.chrome_start(this.currentBrowser())
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

    currentID() {
        return `[CHROME: ${this.id}]`
    }
    currentJob() {
        return `[CHROME: ${this.id}]` + (this.jobsCount ? ` [JOB: ${this.currentJobId}]` : '')
    }
    currentBrowser() {
        return `[CHROME: ${this.id}]`.padEnd(8, ' ') + ` [PID: ${this.browser.process().pid}]`.padEnd(13, ' ') + ` [URL: ${this.wsEndpoint}]`
    }

}