/** Pure helpers for the floating pet companion (no React, no DOM). */
export type Point = { x: number; y: number }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Keeps a point inside the bounds (used to keep the pet on screen). */
export function clampPoint(p: Point, b: Bounds): Point {
  return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) }
}

export function randomItem<T>(items: readonly T[], rng: () => number = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!
}
