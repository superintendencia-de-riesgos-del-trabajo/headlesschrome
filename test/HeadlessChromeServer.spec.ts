import { HeadLessChromeServer } from "../src/HeadlessChromeServer"
import _ from "lodash";
import td from "testdouble";
import { IHeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory";
import { IHeadlessChromeDriver } from "../src/HeadlessChromeDriver";
import { EventEmitter } from 'events';
import { ChildProcess } from "child_process";
import { IdGenerator } from "../src/utils";
import { IHttpProxyFactory } from "../src/ProxyFactory";
import { IHttpProxy } from "../src/HttpProxy";
import { IHttpServerFactory } from "../src/HttpServerFactory";
import { IHttpServer } from "../src/HttpServer";

const idGenerator: IdGenerator = new IdGenerator();

class MockHeadlessChromeDriver extends EventEmitter implements IHeadlessChromeDriver {
    constructor() {
        super();

        var mockProcess = td.object<ChildProcess>();
        this.id = idGenerator.next();
        this.process = mockProcess;

        this.wsEndpoint = "ws://localhost:30000/";
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

class MockHttpServer extends EventEmitter implements IHttpServer {
    onUpgrade(listener: (...args: any[]) => void): IHttpServer {
        this.on("upgrade", listener);
        return this;
    }

    start() {

    }

    stop() {

    }
}

describe("HeadlessChromeServer", () => {
    let factoryDriverMock: IHeadlessChromeDriverFactory = undefined;
    let factoryProxyMock: IHttpProxyFactory = undefined;
    let factoryServerMock: IHttpServerFactory = undefined;

    let httpServerMock = new MockHttpServer();

    let drivers: IHeadlessChromeDriver[];

    beforeEach(() => {
        factoryDriverMock = td.object<IHeadlessChromeDriverFactory>();
        factoryProxyMock = td.object<IHttpProxyFactory>();
        factoryServerMock = td.object<IHttpServerFactory>();

        let driverMock = () => { return new MockHeadlessChromeDriver() };
        let httpProxyMock = td.object<IHttpProxy>();

        drivers = Array.from({ length: 4 }, driverMock);

        td.when(factoryProxyMock.createInstance()).thenReturn<IHttpProxy>(httpProxyMock);
        td.when(factoryServerMock.createInstance(3000)).thenReturn<IHttpServer>(httpServerMock);
        td.when(factoryDriverMock.createInstance()).thenReturn<IHeadlessChromeDriver>(...drivers);
    });

    beforeEach(() => {
        delete process.env.POOL_SIZE;
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

    it("idleBrowsers should decrease with each connection and add", (done) => {
        const headlessChromeServer = new HeadLessChromeServer(factoryDriverMock, factoryProxyMock, factoryServerMock)
        headlessChromeServer.start().then(() => {
            httpServerMock.emit("upgrade");
            expect(headlessChromeServer.idleBrowsers.length).toBe(headlessChromeServer.poolSize - 1);
            done();
            headlessChromeServer.stop();
        });
    });
});
