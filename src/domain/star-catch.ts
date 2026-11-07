/**
 * "Star Catch" — a 30-second tap game played with the pet. Pure, deterministic game logic
 * (given an RNG): spawning, movement, scoring, timer and game over. No React, no DOM.
 *
 * Positions are fractions (0–1) of the play area so the logic is independent of screen size.
 * Stars are centred on (x, y); STAR_MARGIN keeps them fully inside the area when spawned.
 */

export const GAME_DURATION_MS = 30_000
/** Large frame gaps (tab switches, slow devices) are clamped so stars never teleport. */
export const MAX_TICK_MS = 100
export const STAR_MARGIN = 0.1
export const MAX_STARS = 6
export const GOLDEN_CHANCE = 0.12
export const STAR_POINTS = { normal: 1, golden: 3 } as const
const MIN_STAR_DISTANCE = 0.16

export type Rng = () => number

export type Star = {
  id: number
  /** Horizontal centre, 0–1 of the play area width. */
  x: number
  /** Vertical centre, 0–1 of the play area height. */
  y: number
  golden: boolean
  /** Fall speed in play-area heights per second (0 when stars appear in place). */
  speed: number
  ageMs: number
  /** Static stars disappear after this long; falling stars leave through the bottom. */
  lifetimeMs: number
}

export type GameStatus = 'ready' | 'running' | 'paused' | 'over'

export type GameState = {
  status: GameStatus
  score: number
  remainingMs: number
  stars: Star[]
  nextId: number
  spawnCooldownMs: number
  caught: number
  goldenCaught: number
  /** false = reduced motion: stars appear in place instead of falling. */
  falling: boolean
}

export function createGame(falling = true): GameState {
  return {
    status: 'ready',
    score: 0,
    remainingMs: GAME_DURATION_MS,
    stars: [],
    nextId: 1,
    spawnCooldownMs: 0,
    caught: 0,
    goldenCaught: 0,
    falling,
  }
}

/** A fresh running game (used for both Start and Play again). */
export function startGame(state: Pick<GameState, 'falling'>): GameState {
  return { ...createGame(state.falling), status: 'running', spawnCooldownMs: 300 }
}

export function pauseGame(state: GameState): GameState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state
}

export function resumeGame(state: GameState): GameState {
  return state.status === 'paused' ? { ...state, status: 'running' } : state
}

export function setFalling(state: GameState, falling: boolean): GameState {
  if (state.falling === falling) return state
  return { ...state, falling, stars: state.stars.map((s) => ({ ...s, speed: falling ? fallSpeedFor(s.golden, 0.5) : 0 })) }
}

export function elapsedMs(state: Pick<GameState, 'remainingMs'>): number {
  return GAME_DURATION_MS - state.remainingMs
}

/** Seconds shown on the timer (rounded up so "1" shows until time is really up). */
export function secondsLeft(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

/** Stars come a little quicker as the round goes on: 750 ms → 450 ms between spawns. */
export function spawnInterval(elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / GAME_DURATION_MS))
  return Math.round(750 - 300 * t)
}

export function starPoints(star: Pick<Star, 'golden'>): number {
  return star.golden ? STAR_POINTS.golden : STAR_POINTS.normal
}

function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}

function fallSpeedFor(golden: boolean, r: number): number {
  const base = 0.16 + 0.1 * r
  return golden ? base * 1.3 : base
}

/** Creates a star inside the play area, away from existing stars where possible. */
export function spawnStar(id: number, rng: Rng, falling: boolean, existing: readonly Star[] = []): Star {
  const golden = rng() < GOLDEN_CHANCE
  let x = 0.5
  let y = STAR_MARGIN
  for (let attempt = 0; attempt < 6; attempt++) {
    x = between(rng, STAR_MARGIN, 1 - STAR_MARGIN)
    y = falling ? between(rng, STAR_MARGIN, STAR_MARGIN + 0.1) : between(rng, STAR_MARGIN, 1 - STAR_MARGIN)
    const clear = existing.every((s) => Math.hypot(s.x - x, s.y - y) >= MIN_STAR_DISTANCE)
    if (clear) break
  }
  return {
    id,
    x,
    y,
    golden,
    speed: falling ? fallSpeedFor(golden, rng()) : 0,
    ageMs: 0,
    lifetimeMs: golden ? 1300 : Math.round(between(rng, 1700, 2400)),
  }
}

function isGone(star: Star, falling: boolean): boolean {
  return falling ? star.y > 1 + STAR_MARGIN : star.ageMs >= star.lifetimeMs
}

/** Advances the game by `dtMs`. Only running games change. */
export function tick(state: GameState, dtMs: number, rng: Rng = Math.random): GameState {
  if (state.status !== 'running') return state
  const dt = Math.min(MAX_TICK_MS, Math.max(0, dtMs))
  const remainingMs = Math.max(0, state.remainingMs - dt)
  if (remainingMs === 0) return { ...state, remainingMs: 0, status: 'over', stars: [] }

  let stars = state.stars
    .map((s) => ({ ...s, ageMs: s.ageMs + dt, y: state.falling ? s.y + (s.speed * dt) / 1000 : s.y }))
    .filter((s) => !isGone(s, state.falling))

  let nextId = state.nextId
  let cooldown = state.spawnCooldownMs - dt
  const interval = spawnInterval(GAME_DURATION_MS - remainingMs)
  while (cooldown <= 0) {
    if (stars.length >= MAX_STARS) {
      cooldown = 0
      break
    }
    stars = [...stars, spawnStar(nextId, rng, state.falling, stars)]
    nextId += 1
    cooldown += interval
  }

  return { ...state, remainingMs, stars, nextId, spawnCooldownMs: cooldown }
}

/** Catches a star. Catching twice or after the game ended is a harmless no-op. */
export function catchStar(state: GameState, starId: number): { state: GameState; points: number } {
  if (state.status !== 'running') return { state, points: 0 }
  const star = state.stars.find((s) => s.id === starId)
  if (!star) return { state, points: 0 }
  const points = starPoints(star)
  return {
    points,
    state: {
      ...state,
      score: state.score + points,
      caught: state.caught + 1,
      goldenCaught: state.goldenCaught + (star.golden ? 1 : 0),
      stars: state.stars.filter((s) => s.id !== starId),
    },
  }
}

/** Reads a stored best score; anything unexpected becomes 0. */
export function parseBestScore(raw: string | null | undefined): number {
  if (!raw) return 0
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n < 1_000_000 ? n : 0
}

export function isNewBest(score: number, best: number): boolean {
  return score > 0 && score > best
}

const CHEERS = [
  'That was so much fun — thanks for playing with me!',
  'Yay! You were wonderful out there.',
  'High five! I loved watching the stars with you.',
  'What a lovely round. Let’s play again soon!',
  'You make star-catching look magical!',
] as const

/** A kind message from the pet at the end of every round, whatever the score. */
export function cheerMessage(score: number, best: number, rng: Rng = Math.random): string {
  if (isNewBest(score, best)) return 'A new personal best! I’m so happy for you!'
  return CHEERS[Math.floor(rng() * CHEERS.length) % CHEERS.length]!
}
