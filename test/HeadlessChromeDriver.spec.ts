import { HeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory"
import 'jest-extended';
import 'expect-more';

describe("HeadlessChromeDriver", () => {
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
        driver.startJob(2);

        expect(()=>driver.endJob()).toThrowWithMessage(Error,"cannot start a new job until the previous has finished");
    });
})