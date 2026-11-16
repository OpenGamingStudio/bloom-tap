import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { VERSION } from '../src/config';

describe('version', () => {
  it('VERSION suit package.json (semver)', () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
