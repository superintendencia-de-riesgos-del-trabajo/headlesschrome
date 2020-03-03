import { Signale } from "signale";
import figures from "figures"

const options: any = {
    config: {
        logLevel: 'debug',
        displayDate: true,
        displayTimestamp: true
    },
    types: {
        chrome_start: {
            badge: figures.play,
            color: 'yellow',
            label: 'chrome_start',
            logLevel: 'debug'
        },
        job_start: {
            badge: figures.play,
            color: 'green',
            label: 'job_start',
            logLevel: 'debug'
        },
        job_end: {
            badge: figures.tick,
            color: 'green',
            label: 'job_end',
            logLevel: 'debug'
        },
        job_timeout: {
            badge: figures.warning,
            color: 'magenta',
            label: 'job_timeout',
            logLevel: 'debug'
        },
        chrome_clear: {
            badge: figures.pointer,
            color: 'yellow',
            label: 'chrome_clear',
            logLevel: 'debug'
        },
        chrome_restart: {
            badge: figures.pointerSmall,
            color: 'yellow',
            label: 'chrome_restart',
            logLevel: 'debug'
        },
        nav: {
            badge: figures.arrowRight,
            color: 'blue',
            label: 'navigate',
            logLevel: 'debug'
        }
    }
}

interface LoggerOps {
    chrome_start(...msg)
    job_start(...msg)
    nav(...msg)
    job_timeout(...msg)
    job_end(...msg)
    chrome_clear(...msg)
    chrome_restart(...msg)

    disable();
    logLevel(level: string)
}
export class Logger extends Signale {
    constructor() {
        super(options)
    }
}

type CustomLogger = LoggerOps & Signale
const logger = new Logger() as CustomLogger;
export { logger }
