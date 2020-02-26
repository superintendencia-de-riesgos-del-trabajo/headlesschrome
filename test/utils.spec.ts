import { IdGenerator } from '../src/utils';

const idGenerator = new IdGenerator();

describe("Utils", () => {

    it('id generado debe ser 1', () => {
        expect(idGenerator.next()).toBe(1);
    });

    it('id generado debe ser 2', () => {
        expect(idGenerator.next()).toBe(2);
    });
});
