import { describe, expect, test } from 'vitest'
import {
  CATCH_CHEERS, MAX_SPEED, clampPoint, facingFor, landingPoint, petSpotForBall, randomItem, releaseVelocity,
  runDuration, type Bounds,
} from './pet-catch'

const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 800 }

describe('releaseVelocity', () => {
  test('no movement or single sample → zero', () => {
    expect(releaseVelocity([])).toEqual({ x: 0, y: 0 })
    expect(releaseVelocity([{ x: 1, y: 1, t: 0 }])).toEqual({ x: 0, y: 0 })
  })
  test('uses the recent window of samples', () => {
    const v = releaseVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 500 }, // long pause, then a quick flick right
      { x: 50, y: 0, t: 550 },
      { x: 100, y: -20, t: 600 },
    ])
    expect(v.x).toBeCloseTo(1, 5)
    expect(v.y).toBeCloseTo(-0.2, 5)
  })
})

describe('landingPoint', () => {
  test('a gentle release lands near the hand', () => {
    expect(landingPoint({ x: 200, y: 400 }, { x: 0, y: 0 }, bounds)).toEqual({ x: 200, y: 400 })
  })
  test('glides in the throw direction and stays in bounds', () => {
    const p = landingPoint({ x: 200, y: 400 }, { x: 1, y: 0 }, bounds, 400)
    expect(p).toEqual({ x: 400, y: 400 })
    const off = landingPoint({ x: 390, y: 10 }, { x: 2, y: -2 }, bounds)
    expect(off).toEqual({ x: 400, y: 0 })
  })
  test('wild flicks are capped', () => {
    const p = landingPoint({ x: 0, y: 400 }, { x: 100, y: 0 }, { minX: 0, minY: 0, maxX: 10_000, maxY: 800 }, 400)
    expect(p.x).toBeCloseTo((MAX_SPEED * 400) / 2, 5)
  })
})

test('runDuration is never too slow or too fast', () => {
  expect(runDuration(0)).toBe(0.35)
  expect(runDuration(650)).toBe(1)
  expect(runDuration(5000)).toBe(1.3)
})

test('facing follows horizontal direction, ignoring tiny moves', () => {
  expect(facingFor({ x: 100, y: 0 }, { x: 10, y: 0 }, 'right')).toBe('left')
  expect(facingFor({ x: 100, y: 0 }, { x: 300, y: 0 }, 'left')).toBe('right')
  expect(facingFor({ x: 100, y: 0 }, { x: 104, y: 90 }, 'left')).toBe('left')
})

test('pet spot places paws on the ball and stays in bounds', () => {
  expect(petSpotForBall({ x: 200, y: 400 }, 100, bounds)).toEqual({ x: 150, y: 318 })
  expect(clampPoint(petSpotForBall({ x: 0, y: 0 }, 100, bounds), bounds)).toEqual({ x: 0, y: 0 })
})

test('randomItem picks from the list', () => {
  expect(randomItem(CATCH_CHEERS, () => 0)).toBe(CATCH_CHEERS[0])
  expect(randomItem(CATCH_CHEERS, () => 0.9999)).toBe(CATCH_CHEERS[CATCH_CHEERS.length - 1])
})
