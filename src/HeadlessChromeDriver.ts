import puppeteer, { Target } from "puppeteer"
import { ChildProcess } from "child_process";
import _ from "lodash"
import { EventEmitter } from 'events';
import { logger } from "./Logger"
import { IJob, Job } from "./Job";
import { IBrowserFactory } from "./BrowserFactory";

export interface IHeadlessChromeDriver extends EventEmitter {
    jobLimitExceeded(): boolean;
    startJob(jobId: number): IJob;    
    getCurrentJob(): IJob;
    launch(): Promise<IHeadlessChromeDriver>;
    kill(): Promise<void>;
    clear(): Promise<void>;

    
    browser: puppeteer.Browser;
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
    public browser: puppeteer.Browser;
    wsEndpoint: string;
    process: ChildProcess;
    private jobTimeout: NodeJS.Timeout;
    private launching: boolean;
    private currentJob: IJob;

    constructor(id: number, readonly browserFactory: IBrowserFactory) {
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

        this.currentJob = new Job(jobId);
        this.jobsCount++
        logger.job_start(this.currentJobLog())
        this.jobTimeout = setTimeout(() => {
            this.jobTimeout = null
            logger.job_timeout(this.currentJobLog());
            this.emit("job_timeout", this)
        }, this.jobsTimeout);

        return this.currentJob;
    }

    private endJob(url = null) {
        const job = this.currentJob;
        logger.job_end(this.currentJobLog(), url)
        this.currentJob = null;
        this.clearJobTimeout();
        this.emit("job_end", this);

        if (this.jobLimitExceeded()) {
            logger.warn(`${this.currentIdLog()} job limit exceeded`)
            this.emit("job_limit_exceeded", this); 
        } 

        return job;
    }

    public getCurrentJob() {
        return this.currentJob;
    }

    private clearJobTimeout() {
        this.jobTimeout && clearTimeout(this.jobTimeout)
        this.jobTimeout = null
    }

    private emitDeath() {
        this.emit("death", this);
    }

    public async launch() {
        this.launching = true
        this.jobsCount = 0
        try {
            this.browser = await this.browserFactory.createInstance();
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()

            this.browser.on("disconnected", () => {
                this.emitDeath();
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
            this.clearJobTimeout();
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
            await this.emitDeath();
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