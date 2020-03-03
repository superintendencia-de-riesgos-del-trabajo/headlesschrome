import { HeadLessChromeServer } from "../src/HeadlessChromeServer"
import _ from "lodash";
import td from "testdouble";
import { IHeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory";
import { IHeadlessChromeDriver } from "../src/HeadlessChromeDriver";
import { EventEmitter } from 'events';
import { ChildProcess } from "child_process";
import { IdGenerator, timeout } from "../src/utils";
import { IHttpProxyFactory } from "../src/ProxyFactory";
import { IHttpProxy } from "../src/HttpProxy";
import { IHttpServerFactory } from "../src/HttpServerFactory";
import { IHttpServer } from "../src/HttpServer";
import { logger } from "../src/Logger";
import { Job } from "../src/Job";
import puppeteer from "puppeteer"

const idGenerator: IdGenerator = new IdGenerator();

class MockHeadlessChromeDriver extends EventEmitter implements IHeadlessChromeDriver {
    constructor() {
        super();

        this.id = idGenerator.next();
        this.process = td.object<ChildProcess>();

        td.replace(this.process, "pid", () => this.id);

        this.wsEndpoint = "ws://localhost:30000/";
        this.jobsLimit = 30;
        this.jobsTimeout = 30000;
    }

    browser = td.object<puppeteer.Browser>();
    jobsLimit: number;
    jobsTimeout: number;
    defaultJobLimit = 30;
    defaultJobTimeout = 30;
    currentJob = new Job(1);

    jobLimitExceeded(): boolean {
        return false;
    }

    startJob() {
        return this.currentJob;
    }

    getCurrentJob() {
        return this.currentJob;
    }

    async launch(): Promise<IHeadlessChromeDriver> {
        this.emit("launch", this);
        return this;
    }

    async kill(): Promise<void> {
        this.removeAllListeners();
    }

    async clear(): Promise<void> {

    }

    async restart(): Promise<IHeadlessChromeDriver> {
        this.process = td.object<ChildProcess>();

        td.replace(this.process, "pid", () => this.id + 1000);

        return this;
    }

    log(...msg: any[]) {

    }

    process: ChildProcess;
    wsEndpoint: string;
    id: number;
}

class MockHttpServer extends EventEmitter implements IHttpServer {
    onUpgrade(listener: (...args: any[]) => void): IHttpServer {
        this.on("upgrade", listener);
        return this;
    }

    start() {

    }

    stop() {
        this.removeAllListeners();
    }
}

describe("HeadlessChromeServer", () => {
    let factoryDriverMock: IHeadlessChromeDriverFactory = undefined;
    let factoryProxyMock: IHttpProxyFactory = undefined;
    let factoryServerMock: IHttpServerFactory = undefined;

    let httpServerMock = new MockHttpServer();

    let drivers: IHeadlessChromeDriver[];

    afterAll(() => {
        td.reset();
        process.removeAllListeners();
    });

    beforeEach(() => {
        factoryDriverMock = td.object<IHeadlessChromeDriverFactory>();
        factoryProxyMock = td.object<IHttpProxyFactory>();
        factoryServerMock = td.object<IHttpServerFactory>();

        let driverMock = () => { return new MockHeadlessChromeDriver() };
        let httpProxyMock = td.object<IHttpProxy>();

        drivers = Array.from({ length: 4 }, driverMock);

        td.when(factoryProxyMock.createInstance()).thenReturn<IHttpProxy>(httpProxyMock);
        td.when(factoryServerMock.createInstance()).thenReturn<IHttpServer>(httpServerMock);
        td.when(factoryDriverMock.createInstance()).thenReturn<IHeadlessChromeDriver>(...drivers);

        delete process.env.POOL_SIZE;
    });

    beforeAll(() => {
        logger.disable();
    });

    it("Pool size should be the default value when no enviroment variable is set", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        expect(headlessChromeServer.poolSize).toBe(headlessChromeServer.defaultPoolSize);
    });

    it("Pool size should be set to enviroment variable value", () => {
        const poolSize = "10";
        process.env.POOL_SIZE = poolSize;
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        expect(headlessChromeServer.poolSize).toBe(parseInt(poolSize));
    });
    it("HttpProxy should be created and ready for websockets", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);

        expect(_.get(headlessChromeServer.httpProxy, "options").ws).toBeTruthy();
    });

    it("process.maxListeners should be greater than poolsize", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);

        expect(process.getMaxListeners()).toBe(headlessChromeServer.poolSize + 3);
    });

    it("idleBrowsers should be filled accordingly", async () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();
        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize);

        await headlessChromeServer.stop();
    });

    it("idleBrowsers should decrease with each connection", async () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();

        httpServerMock.emit("upgrade");

        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize - 1);
        await headlessChromeServer.stop();
    });

    it("browserdriver instance should be readded to idleBrowsers after finishing processing", async () => {
        process.env.POOL_SIZE = "1";

        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();

        let driver = headlessChromeServer.idleBrowsers[0];

        httpServerMock.emit("upgrade");
        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize - 1);

        driver.emit("job_end", driver);

        while (headlessChromeServer.idleBrowsers.length == 0) await timeout(50);

        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize);
        await headlessChromeServer.stop();
    });

    it("should restart an instance that has exceeded its limit after finishing processing", async () => {
        process.env.POOL_SIZE = "1";

        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();

        let driver = headlessChromeServer.idleBrowsers[0];

        td.replace(driver, "jobLimitExceeded", () => true);

        httpServerMock.emit("upgrade");

        expect(headlessChromeServer.runningProcesses.includes(driver.process.pid)).toBeTruthy();

        driver.emit("job_limit_exceeded", driver);

        while (headlessChromeServer.idleBrowsers.length == 0) await timeout(50);

        expect(headlessChromeServer.runningProcesses.includes(driver.process.pid)).toBeFalsy();
        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize);

        await headlessChromeServer.stop();
    });

    it("browserdriver instance should be readded to idleBrowsers after a job timeout", async () => {
        process.env.POOL_SIZE = "1";

        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();

        let driver = headlessChromeServer.idleBrowsers[0];

        httpServerMock.emit("upgrade");
        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize - 1);
        expect(headlessChromeServer.runningProcesses.includes(driver.process.pid)).toBeTruthy();

        driver.emit("job_timeout", driver);

        while (headlessChromeServer.idleBrowsers.length == 0) await timeout(50);

        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize);
        expect(headlessChromeServer.runningProcesses.includes(driver.process.pid)).toBeTruthy();

        await headlessChromeServer.stop();
    });

    it("should empty the queue and keep waiting when too man jobs are recived", async () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock);
        await headlessChromeServer.start();

        let driver = headlessChromeServer.idleBrowsers[0];

        httpServerMock.emit("upgrade");
        httpServerMock.emit("upgrade");
        httpServerMock.emit("upgrade");
        httpServerMock.emit("upgrade");
        httpServerMock.emit("upgrade");

        expect(headlessChromeServer.idleBrowsers.length).toBe(0);

        driver.emit("job_end", driver);
        await timeout(1);
        expect(headlessChromeServer.idleBrowsers.length).toBe(1);

        while (headlessChromeServer.idleBrowsers.length == 1) await timeout(100);

        expect(headlessChromeServer.idleBrowsers.length).toBe(0);

        await headlessChromeServer.stop();
    });
});
