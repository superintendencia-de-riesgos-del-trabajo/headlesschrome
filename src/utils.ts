export class IdGenerator {
    last: number = 0
    next(): number {
        return ++this.last
    }
}
export function extend<First, Second>(first: First, second: Second): First & Second {
    const result: Partial<First & Second> = {};
    for (const prop in first) {
        if (first.hasOwnProperty(prop)) {
            (result as First)[prop] = first[prop];
        }
    }
    for (const prop in second) {
        if (second.hasOwnProperty(prop)) {
            (result as Second)[prop] = second[prop];
        }
    }
    return result as First & Second;
}

export function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}