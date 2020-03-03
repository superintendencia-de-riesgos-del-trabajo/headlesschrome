import { HeadlessChromeDriver, IHeadlessChromeDriver } from "./HeadlessChromeDriver";
import { IdGenerator } from "./utils";
import { IBrowserFactory } from "./BrowserFactory";

export interface IHeadlessChromeDriverFactory {
    createInstance(): IHeadlessChromeDriver;
}

export class HeadlessChromeDriverFactory implements IHeadlessChromeDriverFactory {

    private readonly idGenerator: IdGenerator;

    constructor(readonly broswerFactory: IBrowserFactory) {
        this.idGenerator = new IdGenerator();
    }

    public createInstance(): IHeadlessChromeDriver {
        return new HeadlessChromeDriver(this.idGenerator.next(), this.broswerFactory);
    }
}