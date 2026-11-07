import { describe, expect, it } from 'vitest'
import {
  catchStar, cheerMessage, createGame, GAME_DURATION_MS, isNewBest, MAX_STARS, MAX_TICK_MS, parseBestScore,
  pauseGame, resumeGame, secondsLeft, setFalling, spawnInterval, spawnStar, STAR_MARGIN, STAR_POINTS, startGame,
  starPoints, tick, type GameState, type Rng,
} from './star-catch'

/** Deterministic pseudo-random generator for tests. */
function seeded(seed = 42): Rng {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const constant = (v: number): Rng => () => v

function run(state: GameState, ms: number, rng: Rng): GameState {
  let s = state
  for (let t = 0; t < ms; t += 50) s = tick(s, 50, rng)
  return s
}

describe('game lifecycle', () => {
  it('starts ready and only runs after start', () => {
    const ready = createGame()
    expect(ready.status).toBe('ready')
    expect(tick(ready, 50)).toBe(ready)
    const running = startGame(ready)
    expect(running).toMatchObject({ status: 'running', score: 0, remainingMs: GAME_DURATION_MS, stars: [] })
  })

  it('counts down and ends after 30 seconds', () => {
    const rng = seeded()
    let s = startGame(createGame())
    s = run(s, 10_000, rng)
    expect(secondsLeft(s.remainingMs)).toBe(20)
    s = run(s, 20_000, rng)
    expect(s.status).toBe('over')
    expect(s.remainingMs).toBe(0)
    expect(s.stars).toEqual([])
    expect(tick(s, 50, rng)).toBe(s)
  })

  it('clamps large frame gaps', () => {
    const s = tick(startGame(createGame()), 5_000, seeded())
    expect(s.remainingMs).toBe(GAME_DURATION_MS - MAX_TICK_MS)
    expect(tick(startGame(createGame()), -20, seeded()).remainingMs).toBe(GAME_DURATION_MS)
  })

  it('pauses and resumes without losing time', () => {
    const rng = seeded()
    const s = run(startGame(createGame()), 2_000, rng)
    const paused = pauseGame(s)
    expect(paused.status).toBe('paused')
    expect(tick(paused, 50, rng)).toBe(paused)
    const resumed = resumeGame(paused)
    expect(resumed.status).toBe('running')
    expect(resumed.remainingMs).toBe(s.remainingMs)
    expect(pauseGame(createGame()).status).toBe('ready')
    expect(resumeGame(createGame()).status).toBe('ready')
  })

  it('play again resets the score but keeps the motion preference', () => {
    const over: GameState = { ...createGame(false), status: 'over', score: 12, remainingMs: 0 }
    const again = startGame(over)
    expect(again).toMatchObject({ status: 'running', score: 0, falling: false, remainingMs: GAME_DURATION_MS })
  })
})

describe('spawning', () => {
  it('spawns stars within the play area bounds', () => {
    const rng = seeded(7)
    for (let i = 0; i < 500; i++) {
      const falling = spawnStar(i, rng, true)
      expect(falling.x).toBeGreaterThanOrEqual(STAR_MARGIN)
      expect(falling.x).toBeLessThanOrEqual(1 - STAR_MARGIN)
      expect(falling.y).toBeGreaterThanOrEqual(STAR_MARGIN)
      expect(falling.y).toBeLessThanOrEqual(STAR_MARGIN + 0.1)
      expect(falling.speed).toBeGreaterThan(0)
      const still = spawnStar(i, rng, false)
      expect(still.y).toBeGreaterThanOrEqual(STAR_MARGIN)
      expect(still.y).toBeLessThanOrEqual(1 - STAR_MARGIN)
      expect(still.speed).toBe(0)
    }
  })

  it('makes golden stars occasionally', () => {
    expect(spawnStar(1, constant(0.01), true).golden).toBe(true)
    expect(spawnStar(1, constant(0.5), true).golden).toBe(false)
  })

  it('never exceeds the star cap', () => {
    // Static stars with a long life would otherwise pile up.
    const s = run(startGame(createGame(false)), 1_500, constant(0.5))
    expect(s.stars.length).toBeLessThanOrEqual(MAX_STARS)
    expect(s.stars.length).toBeGreaterThan(0)
  })

  it('spawns faster as the round progresses', () => {
    expect(spawnInterval(0)).toBe(750)
    expect(spawnInterval(GAME_DURATION_MS)).toBe(450)
    expect(spawnInterval(GAME_DURATION_MS / 2)).toBe(600)
  })
})

describe('movement', () => {
  it('moves falling stars down and removes them past the bottom', () => {
    let s = startGame(createGame(true))
    const star = { ...spawnStar(99, constant(0.5), true), speed: 1 }
    s = { ...s, stars: [star], spawnCooldownMs: 100_000 }
    const after = tick(s, 100)
    expect(after.stars[0]!.y).toBeCloseTo(star.y + 0.1)
    const gone = run(s, 2_000, constant(0.5))
    expect(gone.stars.find((x) => x.id === 99)).toBeUndefined()
  })

  it('keeps static stars in place until they fade', () => {
    let s = startGame(createGame(false))
    const star = spawnStar(5, constant(0.5), false)
    s = { ...s, stars: [star], spawnCooldownMs: 100_000 }
    const later = tick(s, 100)
    expect(later.stars[0]).toMatchObject({ x: star.x, y: star.y, ageMs: 100 })
    const gone = run(s, star.lifetimeMs + 100, constant(0.5))
    expect(gone.stars.find((x) => x.id === 5)).toBeUndefined()
  })

  it('switches stars to appear in place when reduced motion turns on', () => {
    const s = { ...startGame(createGame(true)), stars: [spawnStar(1, constant(0.5), true)] }
    const still = setFalling(s, false)
    expect(still.falling).toBe(false)
    expect(still.stars[0]!.speed).toBe(0)
    expect(setFalling(still, false)).toBe(still)
  })
})

describe('scoring', () => {
  it('scores +1 for normal and +3 for golden stars', () => {
    expect(starPoints({ golden: false })).toBe(STAR_POINTS.normal)
    expect(starPoints({ golden: true })).toBe(STAR_POINTS.golden)
    const normal = spawnStar(1, constant(0.5), true)
    const golden = { ...spawnStar(2, constant(0.5), true), golden: true }
    let s: GameState = { ...startGame(createGame()), stars: [normal, golden] }
    const first = catchStar(s, 1)
    expect(first.points).toBe(1)
    s = first.state
    const second = catchStar(s, 2)
    expect(second.points).toBe(3)
    expect(second.state).toMatchObject({ score: 4, caught: 2, goldenCaught: 1, stars: [] })
  })

  it('ignores double taps, unknown stars and finished games', () => {
    const star = spawnStar(1, constant(0.5), true)
    const s: GameState = { ...startGame(createGame()), stars: [star] }
    const once = catchStar(s, 1).state
    const twice = catchStar(once, 1)
    expect(twice.points).toBe(0)
    expect(twice.state.score).toBe(1)
    expect(catchStar(s, 404).points).toBe(0)
    expect(catchStar({ ...s, status: 'over' }, 1).points).toBe(0)
    expect(catchStar({ ...s, status: 'paused' }, 1).points).toBe(0)
  })
})

describe('best score & cheers', () => {
  it('parses stored best scores safely', () => {
    expect(parseBestScore('17')).toBe(17)
    expect(parseBestScore(null)).toBe(0)
    expect(parseBestScore('-3')).toBe(0)
    expect(parseBestScore('abc')).toBe(0)
    expect(parseBestScore('2.5')).toBe(0)
  })

  it('detects a new best only for a real improvement', () => {
    expect(isNewBest(5, 4)).toBe(true)
    expect(isNewBest(4, 4)).toBe(false)
    expect(isNewBest(0, 0)).toBe(false)
  })

  it('always cheers kindly, whatever the score', () => {
    for (const score of [0, 1, 50]) {
      for (const r of [0, 0.3, 0.99]) {
        const msg = cheerMessage(score, 100, constant(r))
        expect(msg.length).toBeGreaterThan(0)
        expect(msg).not.toMatch(/miss|fail|bad|lose|lost|only/i)
      }
    }
    expect(cheerMessage(10, 3)).toMatch(/personal best/)
  })
})
