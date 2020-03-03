import { HeadlessChromeDriverFactory } from "../src/HeadlessChromeDriverFactory"
import 'jest-extended';
import 'expect-more';
import { logger } from "../src/Logger";

describe("HeadlessChromeDriver", () => {
    beforeAll(() => {
        logger.disable();
    });

    beforeEach(() => {
        delete process.env.INSTANCE_JOB_LIMIT;
        delete process.env.INSTANCE_JOB_TIMEOUT;
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

    it("should throw error when starting a new job before the previous has finished", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance();
        driver.startJob(1);
        expect(() => driver.startJob(2)).toThrowWithMessage(Error, "cannot start a new job until the previous has finished");
        driver.endJob();
    });

    it("jobsLimit should be the default value when no environment is set", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance()

        expect(driver.jobsLimit).toBe(driver.defaultJobLimit + driver.id);
    });

    it("jobsTimeout should be default when no environment is set", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance()

        expect(driver.jobsTimeout).toBe(driver.defaultJobTimeout * 1000);
    });

    it("jobsLimit should be set to the defined value", () => {
        let limit = "10";
        process.env.INSTANCE_JOB_LIMIT = limit;

        const driver = new HeadlessChromeDriverFactory().createInstance();

        expect(driver.jobsLimit).toBe(parseInt(limit) + driver.id);
    });

    it("jobsTimeout should be set to the defined value", () => {
        let timeout = "10";
        process.env.INSTANCE_JOB_TIMEOUT = timeout;

        const driver = new HeadlessChromeDriverFactory().createInstance()

        expect(driver.jobsTimeout).toBe(parseInt(timeout) * 1000);
    });

    it("jobsTimeout should be set to the defined value", () => {
        const driver = new HeadlessChromeDriverFactory().createInstance()

        var job = driver.startJob(1);
        expect(() => driver.startJob(2)).toThrowError();
        expect(driver.getCurrentJob()).toBe(job);
    });
})