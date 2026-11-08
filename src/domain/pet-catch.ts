/**
 * Pure helpers for the pet's game of catch: where a flung ball lands, how long the pet takes
 * to get there, and which way it faces. No React, no DOM.
 */
export type Point = { x: number; y: number }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
export type Sample = Point & { t: number }

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function clampPoint(p: Point, b: Bounds): Point {
  return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) }
}

/** Velocity (px/ms) from the pointer samples of the last `windowMs` of a drag. */
export function releaseVelocity(samples: readonly Sample[], windowMs = 90): Point {
  if (samples.length < 2) return { x: 0, y: 0 }
  const last = samples[samples.length - 1]!
  let first = samples[samples.length - 2]!
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i]!
    if (last.t - samples[i]!.t >= windowMs) break
  }
  const dt = last.t - first.t
  if (dt <= 0) return { x: 0, y: 0 }
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
}

/** Max speed considered, so a wild flick cannot send the ball absurdly far. */
export const MAX_SPEED = 3 // px/ms

/**
 * Where a ball released at `from` with `velocity` comes to rest: it glides for `glideMs` while
 * slowing down (distance = v * glideMs / 2), then stays inside the play area.
 */
export function landingPoint(from: Point, velocity: Point, bounds: Bounds, glideMs = 420): Point {
  const speed = Math.hypot(velocity.x, velocity.y)
  const scale = speed > MAX_SPEED ? MAX_SPEED / speed : 1
  return clampPoint(
    { x: from.x + (velocity.x * scale * glideMs) / 2, y: from.y + (velocity.y * scale * glideMs) / 2 },
    bounds,
  )
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Seconds the pet needs to run `px` pixels (quick for short hops, never sluggish). */
export function runDuration(px: number): number {
  return clamp(px / 650, 0.35, 1.3)
}

/** The pet looks towards where it is going (keeps its current facing for tiny moves). */
export function facingFor(from: Point, to: Point, current: 'left' | 'right'): 'left' | 'right' {
  const dx = to.x - from.x
  if (Math.abs(dx) < 8) return current
  return dx < 0 ? 'left' : 'right'
}

/** Top-left for the pet so that its paws (bottom centre) meet the ball's centre. */
export function petSpotForBall(ball: Point, petSize: number, bounds: Bounds): Point {
  return clampPoint({ x: ball.x - petSize / 2, y: ball.y - petSize * 0.82 }, bounds)
}

export const CATCH_CHEERS = [
  'Got it!', 'Again! Again!', 'Yay! 🎾', 'Nice throw!', 'Woohoo!', 'That was fun!', 'Catch master!',
] as const

export function randomItem<T>(items: readonly T[], rng: () => number = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!
}
