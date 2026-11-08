import { expect, test } from 'vitest'
import { clamp, clampPoint, randomItem } from './pet-companion'

test('clamp keeps values in range', () => {
  expect(clamp(5, 0, 10)).toBe(5)
  expect(clamp(-3, 0, 10)).toBe(0)
  expect(clamp(42, 0, 10)).toBe(10)
})

test('clampPoint keeps the pet on screen', () => {
  const b = { minX: 6, minY: 6, maxX: 300, maxY: 600 }
  expect(clampPoint({ x: -50, y: 900 }, b)).toEqual({ x: 6, y: 600 })
  expect(clampPoint({ x: 100, y: 100 }, b)).toEqual({ x: 100, y: 100 })
})

test('randomItem picks from the list', () => {
  const items = ['a', 'b', 'c'] as const
  expect(randomItem(items, () => 0)).toBe('a')
  expect(randomItem(items, () => 0.9999)).toBe('c')
})
