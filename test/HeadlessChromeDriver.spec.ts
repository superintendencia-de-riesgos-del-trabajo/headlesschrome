import { HeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory"
import 'jest-extended';
import 'expect-more';
import { logger } from "../src/Logger";
import td from "testdouble";
import puppeteer, { Target } from "puppeteer"
import { timeout } from "../src/utils";
import { IBrowserFactory } from "../src/BrowserFactory";
import { EventEmitter } from "events";
import { ChildProcess } from "child_process";

describe("HeadlessChromeDriver", () => {
    let eventEmitter: EventEmitter = new EventEmitter();
    let browserFactoryMock = undefined;
    let puppeteerMock: puppeteer.Browser = undefined;
    let childProcess: ChildProcess = undefined;
    let targetMock: Target

    afterEach(() => {
        td.reset();
    });

    beforeAll(() => {
        logger.disable();
    });

    beforeEach(() => {
        browserFactoryMock = td.object<IBrowserFactory>();
        puppeteerMock = td.object<puppeteer.Browser>();
        childProcess = td.object<ChildProcess>();
        targetMock = td.object<Target>();

        td.when(targetMock.type()).thenReturn("browser");
        td.when(targetMock.url()).thenReturn("http://www.google.com");
        td.replace(puppeteerMock, "on", eventEmitter.on.bind(eventEmitter));
        td.replace(puppeteerMock, "emit", eventEmitter.emit.bind(eventEmitter));    
        td.replace(childProcess, "pid", () => 1);

        td.when(puppeteerMock.process()).thenReturn(childProcess);
        td.when(browserFactoryMock.createInstance()).thenReturn(puppeteerMock);

        delete process.env.INSTANCE_JOB_LIMIT;
        delete process.env.INSTANCE_JOB_TIMEOUT;
    });

    it("jobLimitExceeded should be false until driver process 30+id jobs ", async () => {
        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance()
        await driver.launch();
        expect(driver.jobLimitExceeded()).toBeFalse();        

        for (let i = 0; i < driver.defaultJobLimit + driver.id; i++) {            
            driver.startJob(i);
            puppeteerMock.emit("targetcreated", targetMock);
            puppeteerMock.emit("targetdestroyed", targetMock);
        }
        
        expect(driver.jobLimitExceeded()).toBeTrue()
    });

    it("should throw error when starting a new job before the previous has finished", async () => {
        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance();
        await driver.launch();

        driver.startJob(1);
        expect(() => driver.startJob(2)).toThrowWithMessage(Error, "cannot start a new job until the previous has finished");        
    });

    it("jobsLimit should be the default value when no environment is set", () => {
        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance()

        expect(driver.jobsLimit).toBe(driver.defaultJobLimit + driver.id);
    });

    it("jobsTimeout should be default when no environment is set", () => {
        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance()

        expect(driver.jobsTimeout).toBe(driver.defaultJobTimeout * 1000);
    });

    it("jobsLimit should be set to the defined value", () => {
        let limit = "10";
        process.env.INSTANCE_JOB_LIMIT = limit;

        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance();

        expect(driver.jobsLimit).toBe(parseInt(limit) + driver.id);
    });

    it("jobsTimeout should be set to the defined value", () => {
        let timeout = "10";
        process.env.INSTANCE_JOB_TIMEOUT = timeout;

        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance()

        expect(driver.jobsTimeout).toBe(parseInt(timeout) * 1000);
    });

    it("job should remain the same while it has not finished processing", async () => {
        const driver = new HeadlessChromeDriverFactory(browserFactoryMock).createInstance()
        await driver.launch();

        var job = driver.startJob(1);
        expect(() => driver.startJob(2)).toThrowError();
        expect(driver.getCurrentJob()).toBe(job);
    });
})