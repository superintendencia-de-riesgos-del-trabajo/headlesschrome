import { HeadLessChromeServer } from "../src/HeadlessChromeServer"
import httpProxy from "http-proxy";
import http from "http";
import _ from "lodash";
import td from "testdouble";
import { IHeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory";
import { IHeadlessChromeDriver } from "../src/HeadlessChromeDriver";
import { EventEmitter } from 'events';
import { ChildProcess } from "child_process";


var idGlobal = 0;

class MockHeadlessChromeDriver extends EventEmitter implements IHeadlessChromeDriver {
    constructor() {
        super();
        var mockProcess = td.object<ChildProcess>();
        this.id = ++idGlobal;
        this.process = mockProcess;
    }

    jobLimitExceeded(): boolean {
        return false;
    }

    startJob() {
    }

    async launch(): Promise<IHeadlessChromeDriver> {
        this.emit("launch", this);
        return this;
    }
    async kill(): Promise<void> {

    }

    async clear(): Promise<void> {
    }

    async restart(): Promise<IHeadlessChromeDriver> {
        return this;
    }

    log(...msg: any[]) {

    }

    process: ChildProcess;
    wsEndpoint: string;
    id: number;
}

describe("HeadlessChromeServer", () => {
    var factoryMock: IHeadlessChromeDriverFactory = undefined;

    beforeAll(() => {
        factoryMock = td.object<IHeadlessChromeDriverFactory>();
        let driverMock = () => { return new MockHeadlessChromeDriver() };

        td.when(factoryMock.createInstance()).thenReturn<IHeadlessChromeDriver>(driverMock(), driverMock(), driverMock(), driverMock());
    });

    beforeEach(() => {
        delete process.env.POOL_SIZE;
    });

    it("Pool size should be the default value when no enviroment variable is set", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);
        expect(headlessChromeServer.poolSize).toBe(headlessChromeServer.defaultPoolSize);
    });

    it("Pool size should be set to enviroment variable value", () => {
        const poolSize = "20";
        process.env.POOL_SIZE = poolSize;
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);
        expect(headlessChromeServer.poolSize).toBe(parseInt(poolSize));
    });

    it("HttpServer should be created", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);

        expect(headlessChromeServer.httpServer instanceof http.Server).toBeTruthy();
    });

    it("HttpProxy should be created and ready for websockets", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);

        expect(headlessChromeServer.httpProxy instanceof httpProxy).toBeTruthy();
        expect(_.get(headlessChromeServer.httpProxy, "options").ws).toBeTruthy();
    });

    it("process.maxListeners should be greater than poolsize", () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);

        expect(process.getMaxListeners()).toBe(headlessChromeServer.poolSize + 3);
    });

    it("", async () => {
        const headlessChromeServer = new HeadLessChromeServer(factoryMock);
        try { await headlessChromeServer.start(); } catch (e) { console.error(e); }

        expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize);
    });
});