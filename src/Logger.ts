import { Signale, SignaleOptions, } from "signale";
import figures from "figures"

const options: any = {
    types: {
        chrome_start: {
            badge: figures.play,
            color: 'yellow',
            label: 'chrome_start',
            logLevel: 'info'
        },
        job_start: {
            badge: figures.play,
            color: 'green',
            label: 'job_start',
            logLevel: 'info'
        },
        job_end: {
            badge: figures.square,
            color: 'green',
            label: 'job_end',
            logLevel: 'info'
        },
        job_timeout: {
            badge: figures.warning,
            color: 'magenta',
            label: 'job_timeout',
            logLevel: 'info'
        },
        chrome_clear: {
            badge: figures.pointer,
            color: 'yellow',
            label: 'chrome_clear',
            logLevel: 'info'
        },
        chrome_restart: {
            badge: figures.pointerSmall,
            color: 'yellow',
            label: 'chrome_restart',
            logLevel: 'info'
        },
    }
}

interface CustomLogger {
    chrome_start(...msg)
    job_start(...msg)
    job_timeout(...msg)
    job_end(...msg)
    chrome_clear(...msg)
    chrome_restart(...msg)
}
export class Logger extends Signale {
    constructor() {
        super(options)

        this.config({ displayTimestamp: true,logLevel:"info" }as any)
    }
}

export const logger: CustomLogger & Signale = new Logger() as any

