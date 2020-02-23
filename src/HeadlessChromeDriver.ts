import puppeteer from "puppeteer"
import treekill from "tree-kill"
import { ChildProcess } from "child_process";
import { _ } from "lodash"
import { IdGenerator } from "./utils";
import { HeadLessChromeServer } from "./HeadlessChromeServer";

export class HeadlessChromeDriver {
    id: number
    startTime: Date
    browser: puppeteer.Browser
    wsEndpoint: string
    process: ChildProcess
    poolServer: HeadLessChromeServer

    constructor(poolServer: HeadLessChromeServer, idGen: IdGenerator) {
        this.id = idGen.next()
        this.poolServer = poolServer
    }

    async launch() {
        try {

            this.browser = await puppeteer.launch({
                args: ['--no-sandbox', '--enable-logging', '--v1=1', '--disable-setuid-sandbox', '--disable-gpu'],
                dumpio: true,
                handleSIGINT: true,
                handleSIGTERM: true,
                headless: true,
                ignoreDefaultArgs: ['--disable-extensions'],
                ignoreHTTPSErrors: true
            });
            this.startTime = new Date()
            this.wsEndpoint = this.browser.wsEndpoint()
            this.process = this.browser.process()
            this.process.setMaxListeners(20)

            process.once("exit", async () => {
                await this.kill()
            })
            this.process.once("exit", async () => {
                await this.restart();
            })
            this.browser.on("disconnected", () => {
                this.log(`browser disconnected`)
                this.restart()
            });
            this.browser.on("targetchanged", (target) => {
                this.log(`${target.type()} changed`, target.url());
            });
            this.browser.on('targetcreated', async (target) => {
                if (target)
                    this.log(`${target.type()} created`, target.url())
            });
            this.browser.on('targetdestroyed', async (target) => {
                this.log(`${target.type()} closed`, target.url())
                if (target.type() == "browser") {
                    this.clear();
                }
            });
        } catch (e) {
            this.error("issue launching browser", e)
        }

        this.log(`starting browser: ${this.browser.process().pid} - ${this.wsEndpoint}`)
        this.poolServer.addIdleBrowser(this)
    }

    async kill() {
        this.log(`killing browser`)
        try {
            this.browser.removeAllListeners()
            await this.browser.close().catch(() => { })
            treekill(this.process.pid, "SIGKILL")
        } catch (e) {
            this.error("issue killing browser",e)
        }
    }

    async clear() {
        this.log(`clearing browser`);
        try {
            const [bk, ...pages] = await this.browser.pages();
            await Promise.all(pages.map(async (page) => await page.close()));
        } catch {
            await this.restart()
        }
        finally {
            this.poolServer.addIdleBrowser(this)
        }
    }

    async restart() {
        try {

            this.log(`restarting browser`)

            await this.kill();
            await this.launch()
        } catch (e) {
            this.error("issue restarting browser", e)
        }
    }

    log(...msg) {
        console.log(`[bwsr:${this.id}]`, ...msg)
    }

    error(...msg) {
        console.log("=================================")
        console.log(`ERROR -> [bwsr:${this.id}]`);
        msg.map(console.log)
        console.log("=================================")
    }
}