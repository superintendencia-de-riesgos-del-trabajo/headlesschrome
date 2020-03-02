import { HeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory"
import 'jest-extended';
import 'expect-more';
import { logger } from "../src/Logger";

describe("HeadlessChromeDriver", () => {
    beforeAll(()=>{
        logger.disable();
    });

    it("jobLimitExceeded should be false until driver process 30+id jobs ", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance()

        expect(driver.jobLimitExceeded()).toBeFalse()
        for (let i = 0; i < 30 + driver.id; i++) {
            driver.startJob(i)
            driver.endJob();
        }
        expect(driver.jobLimitExceeded()).toBeTrue()
    })

    it("",()=>{
        const driver = new HeadlessChromeDriverFactory().createInstance();
        driver.startJob(1);        

        expect(()=>driver.startJob(2)).toThrowWithMessage(Error,"cannot start a new job until the previous has finished");
    });
})