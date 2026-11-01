import { beforeEach, describe, expect, it } from 'vitest';
import { mutateData, readData, resetData } from '../src/data/store.js';

describe('local JSON store mutation semantics', () => {
  beforeEach(async () => resetData());

  it('commits a completed mutation', async () => {
    await mutateData((data) => {
      data.routes[0].name = 'Changed Demo Route';
    });

    expect((await readData()).routes[0].name).toBe('Changed Demo Route');
  });

  it('keeps the prior state when a mutation fails', async () => {
    const originalName = (await readData()).routes[0].name;

    await expect(mutateData((data) => {
      data.routes[0].name = 'Must Not Commit';
      throw new Error('validation failed');
    })).rejects.toThrow('validation failed');

    expect((await readData()).routes[0].name).toBe(originalName);
  });
});
