import { describe, expect, it } from 'vitest'
import { clampLimit, getErrorMessage, isUuid } from './base'

describe('isUuid', () => {
  it.each([
    ['3f2504e0-4f89-11d3-9a0c-0305e82c3301', true],
    ['3F2504E0-4F89-11D3-9A0C-0305E82C3301', true],
    ['00000000-0000-0000-0000-000000000000', true],
    ['not-a-uuid', false],
    ['', false],
    ['3f2504e0-4f89-11d3-9a0c-0305e82c3301x', false],
    ['3f2504e04f8911d39a0c0305e82c3301', false],
  ])('%j → %s', (value, expected) => {
    expect(isUuid(value)).toBe(expected)
  })
})

describe('clampLimit', () => {
  it.each([
    [undefined, 25],
    [0, 25],
    [-1, 25],
    [10, 10],
    [500, 100],
  ])('%j → %d', (input, expected) => {
    expect(clampLimit(input)).toBe(expected)
  })
})

describe('getErrorMessage', () => {
  it('reads Error, string and { message } shapes, else the fallback', () => {
    expect(getErrorMessage(new Error('boom'), 'f')).toBe('boom')
    expect(getErrorMessage('plain', 'f')).toBe('plain')
    expect(getErrorMessage({ message: 'pg error' }, 'f')).toBe('pg error')
    expect(getErrorMessage(42, 'f')).toBe('f')
  })
})
