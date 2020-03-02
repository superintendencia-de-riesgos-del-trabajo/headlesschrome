import { HeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory"
import 'jest-extended';
import 'expect-more';

describe("HeadlessChromeDriver", () => {
    it("jobLimitExceeded should be false until driver process 30+id jobs ", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance()

        expect(driver.jobLimitExceeded()).toBeFalse()
        for (let i = 0; i < 30 + driver.id; i++) {
            driver.startJob()
        }
        expect(driver.jobLimitExceeded()).toBeTrue()
    })
})