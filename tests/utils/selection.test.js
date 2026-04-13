import { describe, it, expect } from 'vitest'
import { toggleSetItem, areAllSelected } from '../../src/utils/selection'

describe('toggleSetItem', () => {
  it('adds an item not in the set', () => {
    const result = toggleSetItem(new Set(['a']), 'b')
    expect(result.has('b')).toBe(true)
    expect(result.has('a')).toBe(true)
  })

  it('removes an item already in the set', () => {
    const result = toggleSetItem(new Set(['a', 'b']), 'a')
    expect(result.has('a')).toBe(false)
    expect(result.has('b')).toBe(true)
  })

  it('returns a new Set, not the original', () => {
    const original = new Set(['a'])
    const result = toggleSetItem(original, 'b')
    expect(result).not.toBe(original)
  })
})

describe('areAllSelected', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('returns true when all member ids are in selectedIds', () => {
    expect(areAllSelected(members, new Set(['a', 'b', 'c']))).toBe(true)
  })

  it('returns false when some are missing', () => {
    expect(areAllSelected(members, new Set(['a', 'b']))).toBe(false)
  })

  it('returns false for empty members array', () => {
    expect(areAllSelected([], new Set(['a']))).toBe(false)
  })
})
