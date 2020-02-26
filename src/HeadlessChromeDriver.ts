import puppeteer, { Target } from "puppeteer"
import { ChildProcess } from "child_process";
import { _ } from "lodash"
import { EventEmitter } from 'events';

export class HeadlessChromeDriver extends EventEmitter {
    id: number
    target: Target
    startTime: Date
    jobsCount: number
    jobsLimit: number
    browser: puppeteer.Browser
    wsEndpoint: string
    process: ChildProcess
    jobTimeout: NodeJS.Timeout
    launching: boolean

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

    public startJob() {
        this.jobsCount++
        this.log("job start")
        this.jobTimeout = setTimeout(() => {
            this.emit("job_timeout", this)
            this.log("job timed out");
        }, 30000)
    }
    private endJob() {
        this.jobTimeout && clearTimeout(this.jobTimeout)
        this.jobTimeout = null
        this.log(`job end`)
        this.emit("job_end", this)
    }
    public async launch() {
        this.launching = true
        this.jobsCount = 0
        this.log("launching browser")
        try {
            this.browser = await puppeteer.launch({
                args: ['--no-sandbox', '--enable-logging', '--v1=1', '--disable-setuid-sandbox', '--disable-gpu'],
                dumpio: false,
                handleSIGINT: true,
                handleSIGTERM: true,
                headless: true,
                ignoreDefaultArgs: ['--disable-extensions'],
                ignoreHTTPSErrors: true
            });
            this.startTime = new Date()
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()

            this.browser.on("disconnected", () => {
                this.log(`browser disconnected`)
                this.restart()
            });
            this.browser.on("targetchanged", (target) => {
                this.log(`${target.type()} changed`, target.url());
            });
            this.browser.on('targetcreated', async (target) => {
                if (!this.target && target.type() == "browser" && !this.launching) {
                    this.target = target
                }
                this.log(`${target.type()} created`, target.url())
            });
            this.browser.on('targetdestroyed', async (target) => {
                this.log(`${target.type()} closed`, target.url())
                if (this.target == target) {
                    this.target = null
                    this.endJob()
                }
            });
        } catch (e) {
            this.error("issue launching browser", e)
        }
        this.log(`browser started: ${this.browser.process().pid} - ${this.wsEndpoint}`)
        this.launching = false
        this.emit("launch", this)
        return this;
    }

    public async kill() {
        this.log(`killing browser`)
        try {
            this.browser.removeAllListeners()
            await this.browser.close()
            this.process.kill();
        } catch (e) {
            this.error("issue killing browser", e)
        }
    }

    public async clear() {
        this.log(`clearing browser`);
        try {
            const [bk, ...pages] = await this.browser.pages();
            await Promise.all(pages.map(async (page) => {
                try { await page.close() } catch{ }
            }));
            bk && bk.removeAllListeners()
            bk && await bk.goto('about:blank');
            const client = await bk.target().createCDPSession()
            try { await client.send("Network.clearBrowserCache") } catch (e) { console.error(e) }
            try { await client.send("Network.clearBrowserCookies") } catch (e) { console.error(e) }
            const [bc, ...contexts] = this.browser.browserContexts();
            contexts.map(async c => { try { await c.close() } catch{ } })
        } catch (e) {
            this.log("issue clearing browser.", e)
            await this.restart()
        }
    }

    public async restart() {
        try {
            this.log(`restarting browser`)
            try { await this.kill() } catch{ };
            return await this.launch()
        } catch (e) {
            this.error("issue restarting browser", e)
        }
    }

    log(...msg) {
        console.log(`[bwsr:${this.id}][${this.jobsCount}]`, ...msg)
    }

    error(...msg) {

        console.error("=================================")
        console.error(`ERROR -> [bwsr:${this.id}]`);
        console.error("---------------------------------")

        msg.map(console.error)
        console.error("=================================")
    }
}