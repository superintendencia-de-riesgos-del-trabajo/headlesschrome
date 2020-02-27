import { IdGenerator } from '../src/utils';

describe("Utils", () => {    
    const idGenerator = new IdGenerator();

    it('id generado debe ser 1', () => {
        expect(idGenerator.next()).toBe(1);
    });

    it('id generado debe ser 2', () => {
        expect(idGenerator.next()).toBe(2);
    });
});
