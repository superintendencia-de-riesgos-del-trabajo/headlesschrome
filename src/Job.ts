export interface IJob {
    readonly jobId: number;
    jobLog(): string;
}

export class Job implements IJob {
    constructor(readonly jobId: number) {

    }

    jobLog(): string {
        return ` [JOB: ${this.jobId}]`
    }
}