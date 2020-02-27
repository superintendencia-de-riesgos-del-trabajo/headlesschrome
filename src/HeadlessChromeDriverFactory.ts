import { HeadlessChromeDriver, IHeadlessChromeDriver } from "./HeadlessChromeDriver";
import { IdGenerator } from "./utils";

export interface IHeadlessChromeDriverFactory{
    createInstance() : IHeadlessChromeDriver;
}

export class HeadlessChromeDriverFactory implements IHeadlessChromeDriverFactory{

    private readonly idGenerator: IdGenerator;

    constructor() {
        this.idGenerator = new IdGenerator();
    }

    public createInstance() : IHeadlessChromeDriver {
        return new HeadlessChromeDriver(this.idGenerator.next());
    }
}