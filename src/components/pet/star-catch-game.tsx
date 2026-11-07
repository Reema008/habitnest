import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Pause, Play, RotateCcw, Sparkles, Star, Timer, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/common/glass-card'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import { PET_NAMES } from '@/types/models'
import {
  catchStar, cheerMessage, createGame, isNewBest, parseBestScore, pauseGame, resumeGame, secondsLeft, setFalling,
  startGame, tick, type GameState,
} from '@/domain/star-catch'
import { Pet } from './pet'

const bestKey = (userId: string) => `habitnest-star-catch-best:${userId}`

function readBest(userId: string): number {
  try {
    return parseBestScore(window.localStorage.getItem(bestKey(userId)))
  } catch {
    return 0
  }
}

function writeBest(userId: string, score: number) {
  try {
    window.localStorage.setItem(bestKey(userId), String(score))
  } catch {
    // Storage can be unavailable (private mode, quota); the best score simply isn't remembered.
  }
}

type Pop = { id: number; x: number; y: number; points: number }
type Result = { message: string; newBest: boolean; score: number; caught: number }

/** "Star Catch": a 30-second tap game. Every round ends with a cheer from the pet. */
export function StarCatchGame() {
  const { userId, profile } = useCurrentUser()
  const reduce = useReducedMotion() ?? false
  const [game, setGame] = useState<GameState>(() => createGame(!reduce))
  const gameRef = useRef(game)
  const [best, setBest] = useState(() => readBest(userId))
  const bestRef = useRef(best)
  const [result, setResult] = useState<Result | null>(null)
  const [round, setRound] = useState(0)
  const [pops, setPops] = useState<Pop[]>([])

  /** Single place where game state changes, so game-over side effects run exactly once. */
  const update = useCallback(
    (fn: (g: GameState) => GameState) => {
      const prev = gameRef.current
      const next = fn(prev)
      if (next === prev) return
      gameRef.current = next
      setGame(next)
      if (prev.status === 'running' && next.status === 'over') {
        const previousBest = bestRef.current
        const newBest = isNewBest(next.score, previousBest)
        if (newBest) {
          bestRef.current = next.score
          setBest(next.score)
          writeBest(userId, next.score)
        }
        setResult({ message: cheerMessage(next.score, previousBest), newBest, score: next.score, caught: next.caught })
      }
    },
    [userId],
  )

  // Animation loop while running.
  useEffect(() => {
    if (game.status !== 'running') return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = now - last
      last = now
      update((g) => tick(g, dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [game.status, update])

  // Pause when the tab or app goes to the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) update(pauseGame)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [update])

  // Follow the reduced-motion preference: stars appear in place instead of falling.
  useEffect(() => {
    update((g) => setFalling(g, !reduce))
  }, [reduce, update])

  function start() {
    setResult(null)
    setPops([])
    setRound((r) => r + 1)
    update((g) => startGame({ falling: g.falling }))
  }

  function onCatch(starId: number) {
    const star = gameRef.current.stars.find((s) => s.id === starId)
    let points = 0
    update((g) => {
      const outcome = catchStar(g, starId)
      points = outcome.points
      return outcome.state
    })
    if (!star || points === 0) return
    const pop = { id: starId, x: star.x, y: star.y, points }
    setPops((p) => [...p, pop])
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 650)
  }

  const seconds = secondsLeft(game.remainingMs)
  const pet = profile.pet_type

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Star} label="Score" value={game.score} />
        <Stat icon={Timer} label="Time" value={`${seconds}s`} role="timer" />
        <Stat icon={Trophy} label="Best" value={best} />
      </div>

      <div
        role="group"
        aria-label="Star Catch play area"
        className="glass relative h-[min(58dvh,440px)] min-h-72 touch-manipulation overflow-hidden rounded-3xl bg-linear-to-b from-sky/30 via-lavender/20 to-transparent"
      >
        {game.status === 'running' ? (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 z-20 size-11 rounded-full"
            aria-label="Pause game"
            onClick={() => update(pauseGame)}
          >
            <Pause className="size-5" />
          </Button>
        ) : null}

        {game.stars.map((star) => (
          <button
            key={star.id}
            type="button"
            aria-label={star.golden ? 'Golden star, 3 points' : 'Star, 1 point'}
            disabled={game.status !== 'running'}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              onCatch(star.id)
            }}
            onClick={() => onCatch(star.id)}
            className={cn(
              'absolute z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none',
              'focus-visible:ring-3 focus-visible:ring-ring/70',
              star.golden && 'bg-lemon/50 shadow-[0_0_18px_4px_var(--color-lemon)]',
            )}
            style={{
              left: `${star.x * 100}%`,
              top: `${star.y * 100}%`,
              opacity: game.falling ? 1 : Math.min(1, (star.lifetimeMs - star.ageMs) / 300),
            }}
          >
            <Star
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                star.golden
                  ? 'size-10 fill-amber-300 text-amber-600 dark:text-amber-200'
                  : 'size-9 fill-lemon text-amber-600 dark:text-amber-200',
              )}
            />
            {star.golden ? <Sparkles aria-hidden className="absolute -right-0.5 -top-0.5 size-4 text-amber-600 dark:text-amber-200" /> : null}
          </button>
        ))}

        <AnimatePresence>
          {pops.map((pop) => (
            <motion.span
              key={pop.id}
              aria-hidden
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: reduce ? 0 : -28 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-lg font-extrabold text-primary"
              style={{ left: `${pop.x * 100}%`, top: `${pop.y * 100}%` }}
            >
              +{pop.points}
            </motion.span>
          ))}
        </AnimatePresence>

        {game.status === 'ready' ? (
          <Overlay>
            {pet ? <Pet type={pet} size={120} label="" gesture="wave" /> : <Star className="size-14 fill-lemon text-amber-600" aria-hidden />}
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold">Ready to catch some stars?</h2>
              <p className="text-sm text-muted-foreground">
                Tap stars as they {game.falling ? 'fall' : 'twinkle'} — each one is 1 point, golden stars are 3. You have 30 seconds!
              </p>
            </div>
            <Button className="h-12 px-8 text-base" onClick={start}>
              <Play className="size-5" /> Start
            </Button>
          </Overlay>
        ) : null}

        {game.status === 'paused' ? (
          <Overlay>
            <h2 className="text-xl font-extrabold">Paused</h2>
            <p className="text-sm text-muted-foreground">Take your time — the stars will wait.</p>
            <div className="flex gap-2">
              <Button className="h-12 px-6" onClick={() => update(resumeGame)}>
                <Play className="size-5" /> Resume
              </Button>
              <Button variant="secondary" className="h-12 px-6" onClick={start}>
                <RotateCcw className="size-5" /> Restart
              </Button>
            </div>
          </Overlay>
        ) : null}

        {game.status === 'over' && result ? (
          <Overlay>
            {pet ? <Pet type={pet} size={128} label="" gesture="bounce" gestureKey={round} expression="grin" /> : null}
            <div className="relative rounded-2xl bg-background/80 px-4 py-2 text-sm font-semibold shadow-sm">
              {pet ? <span className="sr-only">{PET_NAMES[pet]} says: </span> : null}
              {result.message}
            </div>
            <p className="text-lg font-extrabold">
              {result.score} {result.score === 1 ? 'point' : 'points'}
              <span className="block text-sm font-semibold text-muted-foreground">
                {result.caught} {result.caught === 1 ? 'star' : 'stars'} caught{result.newBest ? ' · new best!' : ''}
              </span>
            </p>
            <Button className="h-12 px-8 text-base" onClick={start}>
              <RotateCcw className="size-5" /> Play again
            </Button>
          </Overlay>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {game.status === 'over' && result ? `Time's up! You scored ${result.score} points. ${result.message}` : ''}
        {game.status === 'paused' ? 'Game paused.' : ''}
      </p>

      {!pet ? (
        <GlassCard className="flex items-center justify-between gap-3 text-sm">
          <span>Choose a pet to cheer you on!</span>
          <Button asChild variant="secondary" className="h-11">
            <Link to="/pet">Choose a pet</Link>
          </Button>
        </GlassCard>
      ) : null}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/55 p-5 text-center backdrop-blur-sm">
      {children}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  role,
}: {
  icon: typeof Star
  label: string
  value: React.ReactNode
  role?: 'timer'
}) {
  return (
    <GlassCard className="flex flex-col items-center gap-0.5 px-2 py-2.5" role={role} aria-label={role ? `${label}: ${value}` : undefined}>
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
    </GlassCard>
  )
}
