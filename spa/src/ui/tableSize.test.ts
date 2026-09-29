import { describe, expect, it } from 'vitest';
import { stepTableSize, validTableSize } from './tableSize';

describe('stepTableSize', () => {
  it('goes one step of 10 % up or down', () => {
    expect(stepTableSize(100, 1)).toBe(110);
    expect(stepTableSize(100, -1)).toBe(90);
  });

  it('stays within 70–150 %', () => {
    expect(stepTableSize(150, 1)).toBe(150);
    expect(stepTableSize(70, -1)).toBe(70);
  });

  it('snaps a size between the steps back onto them', () => {
    expect(stepTableSize(104, 1)).toBe(110);
  });
});

describe('validTableSize', () => {
  it('keeps a size within the limits', () => {
    expect(validTableSize(130)).toBe(130);
  });

  it('falls back to 100 % outside them', () => {
    expect(validTableSize(20)).toBe(100);
    expect(validTableSize(400)).toBe(100);
  });
});
