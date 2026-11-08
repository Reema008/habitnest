import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import {
  AnimatePresence, animate, motion, useAnimationControls, useMotionValue, useReducedMotion,
} from 'motion/react'
import {
  CATCH_CHEERS, clampPoint, distance, facingFor, landingPoint, petSpotForBall, randomItem, releaseVelocity,
  runDuration, type Bounds, type Point, type Sample,
} from '@/domain/pet-catch'
import { useCurrentUser } from '@/providers/auth-provider'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { PET_NAMES, type PetType } from '@/types/models'
import { petGreeting } from './greetings'
import { Pet, type PetExpression, type PetGesture } from './pet'

const PET = 84 // px
const BALL = 34 // px
const TAB_BAR = 100 // keep clear of the bottom navigation
const EDGE = 6

type Phase = 'idle' | 'aim' | 'fly' | 'chase' | 'celebrate'
type Trick = 'wave' | 'nod' | 'bounce' | 'spin' | 'wiggle' | 'hop' | 'hearts'

const TRICKS: { trick: Trick; say: readonly string[] }[] = [
  { trick: 'wave', say: ['Hi there! 👋', 'Hello, friend!'] },
  { trick: 'nod', say: ['Mm-hmm!', 'You got this!'] },
  { trick: 'bounce', say: ['Boing!', 'Wheee!'] },
  { trick: 'spin', say: ['Ta-da! ✨', 'Look at me spin!'] },
  { trick: 'wiggle', say: ['Hehe!', 'Wiggle wiggle!'] },
  { trick: 'hop', say: ['Hop hop!', 'Up we go!'] },
  { trick: 'hearts', say: ['Love you! 💜', 'Sending hugs!'] },
]

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const on = () => setVp(read())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

/** Floating pet that follows the user around the app. Tap for tricks; fling the ball to play catch. */
export function PetCompanion() {
  const { profile } = useCurrentUser()
  const enabled = usePrefs((s) => s.petCompanion)
  const { pathname } = useLocation()
  // The pet page already shows the big pet, so the companion steps aside there.
  if (!enabled || !profile.pet_type || pathname.startsWith('/pet')) return null
  return <Companion type={profile.pet_type} name={profile.display_name} />
}

/** Greet once per app session (not on every page change). */
let greetedThisSession = false

function Companion({ type, name: displayName }: { type: PetType; name: string }) {
  const reduce = useReducedMotion() ?? false
  const { w, h } = useViewport()
  const saved = usePrefs((s) => s.petPosition)
  const savePosition = usePrefs((s) => s.setPetPosition)

  const petBounds: Bounds = { minX: EDGE, minY: EDGE + 40, maxX: w - PET - EDGE, maxY: h - PET - TAB_BAR }
  const ballBounds: Bounds = {
    minX: BALL / 2 + EDGE, minY: 70, maxX: w - BALL / 2 - EDGE, maxY: h - TAB_BAR - BALL / 2 + 10,
  }
  const start = clampPoint(saved ?? { x: w - PET - 14, y: h - PET - TAB_BAR - 8 }, petBounds)

  const petX = useMotionValue(start.x)
  const petY = useMotionValue(start.y)
  const ballX = useMotionValue(0)
  const ballY = useMotionValue(0)
  const ballSpin = useMotionValue(0)
  const body = useAnimationControls()

  const [phase, setPhase] = useState<Phase>('idle')
  const [facing, setFacing] = useState<'left' | 'right'>('left')
  const [gesture, setGesture] = useState<PetGesture | null>(null)
  const [gestureKey, setGestureKey] = useState(0)
  const [expression, setExpression] = useState<PetExpression | undefined>(undefined)
  const [bubble, setBubble] = useState<string | null>(null)
  const [hearts, setHearts] = useState(0)
  const samples = useRef<Sample[]>([])
  const grab = useRef<Point>({ x: 0, y: 0 })
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const busy = phase !== 'idle'

  /** Where the ball rests: beside the pet's paws, on the side with more room. */
  const restBall = useCallback(() => {
    const side = petX.get() + PET / 2 > w / 2 ? -1 : 1
    ballX.set(petX.get() + PET / 2 + side * (PET / 2 + BALL / 2 - 6))
    ballY.set(petY.get() + PET - BALL / 2 - 2)
  }, [petX, petY, ballX, ballY, w])

  // Keep everything on screen when the window changes size.
  useEffect(() => {
    const p = clampPoint({ x: petX.get(), y: petY.get() }, petBounds)
    petX.set(p.x)
    petY.set(p.y)
    if (phase === 'idle') restBall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h])

  useEffect(() => () => clearTimeout(bubbleTimer.current), [])

  const say = useCallback((text: string, ms = 2200) => {
    clearTimeout(bubbleTimer.current)
    setBubble(text)
    bubbleTimer.current = setTimeout(() => setBubble(null), ms)
  }, [])

  const playGesture = (g: PetGesture) => {
    setGesture(g)
    setGestureKey((k) => k + 1)
  }

  const trick = async () => {
    if (busy) return
    const { trick: t, say: lines } = randomItem(TRICKS)
    say(randomItem(lines))
    setExpression(t === 'hearts' || t === 'nod' ? 'wink' : 'grin')
    if (reduce) {
      if (t === 'hearts') setHearts((n) => n + 1)
    } else if (t === 'wave' || t === 'nod' || t === 'bounce') {
      playGesture(t)
    } else if (t === 'spin') {
      await body.start({ rotate: [0, 360], transition: { duration: 0.7, ease: 'easeInOut' } })
      body.set({ rotate: 0 })
    } else if (t === 'wiggle') {
      await body.start({ rotate: [0, -14, 14, -9, 9, 0], transition: { duration: 0.65 } })
    } else if (t === 'hop') {
      await body.start({ y: [0, -30, 0, -14, 0], transition: { duration: 0.7, ease: 'easeOut' } })
    } else {
      setHearts((n) => n + 1)
      playGesture('nod')
    }
    setTimeout(() => setExpression(undefined), 1600)
  }

  const throwTo = async (landing: Point) => {
    setPhase('fly')
    if (reduce) {
      ballX.set(landing.x)
      ballY.set(landing.y)
    } else {
      const from = { x: ballX.get(), y: ballY.get() }
      const t = Math.max(0.25, Math.min(0.6, distance(from, landing) / 900))
      await Promise.all([
        animate(ballX, landing.x, { duration: t, ease: [0.15, 0.8, 0.3, 1] }),
        animate(ballY, landing.y, { duration: t, ease: [0.15, 0.8, 0.3, 1] }),
        animate(ballSpin, ballSpin.get() + 540, { duration: t, ease: 'easeOut' }),
      ])
    }

    // Chase!
    const from = { x: petX.get(), y: petY.get() }
    const target = petSpotForBall(landing, PET, petBounds)
    setFacing((f) => facingFor(from, target, f))
    setPhase('chase')
    setExpression('grin')
    if (reduce) {
      petX.set(target.x)
      petY.set(target.y)
    } else {
      const dur = runDuration(distance(from, target))
      void body.start({ y: [0, -14, 0], transition: { duration: 0.26, repeat: Infinity, ease: 'easeOut' } })
      await Promise.all([
        animate(petX, target.x, { duration: dur, ease: 'easeInOut' }),
        animate(petY, target.y, { duration: dur, ease: 'easeInOut' }),
      ])
      body.stop()
    }

    // Caught it.
    setPhase('celebrate')
    say(randomItem(CATCH_CHEERS))
    setHearts((n) => n + 1)
    if (!reduce) {
      await body.start({ y: [0, -38, 0], scale: [1, 1.12, 1], transition: { duration: 0.5, ease: 'easeOut' } })
      playGesture('wave')
    }
    savePosition({ x: petX.get(), y: petY.get() })
    setTimeout(() => {
      restBall()
      setExpression(undefined)
      setPhase('idle')
    }, reduce ? 600 : 1300)
  }

  // ---- Ball pointer handling (drag anywhere, release to throw) ----
  const onBallDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (busy) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    grab.current = { x: e.clientX - ballX.get(), y: e.clientY - ballY.get() }
    samples.current = [{ x: ballX.get(), y: ballY.get(), t: e.timeStamp }]
    setPhase('aim')
    setExpression('grin')
    say('Throw it! Throw it!', 4000)
  }
  const onBallMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'aim') return
    const p = clampPoint({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y }, ballBounds)
    ballX.set(p.x)
    ballY.set(p.y)
    samples.current.push({ ...p, t: e.timeStamp })
    if (samples.current.length > 20) samples.current.shift()
    const petCenter = petX.get() + PET / 2
    setFacing(p.x < petCenter ? 'left' : 'right')
  }
  const onBallUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'aim') return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const here = { x: ballX.get(), y: ballY.get() }
    void throwTo(landingPoint(here, releaseVelocity(samples.current), ballBounds))
  }
  const onBallKey = (e: React.KeyboardEvent) => {
    if (busy || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    const randomSpot = {
      x: ballBounds.minX + Math.random() * (ballBounds.maxX - ballBounds.minX),
      y: ballBounds.minY + Math.random() * (ballBounds.maxY - ballBounds.minY),
    }
    void throwTo(randomSpot)
  }

  // Place the ball next to the pet on first render, and say hello once per session.
  useEffect(() => {
    restBall()
    if (!greetedThisSession) {
      greetedThisSession = true
      setTimeout(() => {
        say(petGreeting(displayName), 5000)
        playGesture('wave')
      }, 600)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const name = PET_NAMES[type]
  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-live="polite">
      {/* Ball */}
      <AnimatePresence>
        {phase !== 'celebrate' && phase !== 'chase' ? (
          <motion.button
            key="ball"
            type="button"
            aria-label={`Ball — drag and let go to throw it for ${name}. Press Enter to throw.`}
            className="pointer-events-auto absolute left-0 top-0 touch-none rounded-full focus-visible:outline-3 focus-visible:outline-ring"
            style={{ x: ballX, y: ballY, rotate: ballSpin, width: BALL, height: BALL, marginLeft: -BALL / 2, marginTop: -BALL / 2 }}
            initial={{ scale: 0 }}
            animate={{ scale: phase === 'aim' ? 1.15 : 1 }}
            exit={{ scale: 0, transition: { duration: 0.15 } }}
            onPointerDown={onBallDown}
            onPointerMove={onBallMove}
            onPointerUp={onBallUp}
            onPointerCancel={onBallUp}
            onKeyDown={onBallKey}
          >
            <PlayBall />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Pet */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`${name}. Tap for a trick, drag to move, or throw the ball to play catch.`}
        className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none select-none rounded-full focus-visible:outline-3 focus-visible:outline-ring active:cursor-grabbing"
        style={{ x: petX, y: petY, width: PET, height: PET }}
        drag={!busy}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ left: petBounds.minX, right: petBounds.maxX, top: petBounds.minY, bottom: petBounds.maxY }}
        onDragStart={() => setBubble(null)}
        onDragEnd={() => {
          savePosition({ x: petX.get(), y: petY.get() })
          restBall()
        }}
        onTap={() => void trick()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void trick()
          }
        }}
      >
        {/* soft shadow */}
        <span className="absolute -bottom-1 left-1/2 h-2.5 w-14 -translate-x-1/2 rounded-full bg-foreground/15 blur-[2px]" aria-hidden />
        <motion.div animate={body} className="relative h-full w-full">
          <div style={{ transform: `scaleX(${facing === 'left' ? -1 : 1})` }} className="h-full w-full transition-transform duration-200">
            <Pet type={type} size={PET} gesture={gesture} gestureKey={gestureKey} expression={expression} label="" />
          </div>
        </motion.div>

        <Hearts key={hearts} burst={hearts} />

        <AnimatePresence>
          {bubble ? (
            <motion.div
              key={bubble}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                'glass absolute bottom-full mb-1 w-max max-w-48 rounded-2xl px-3 py-1.5 text-xs font-bold',
                // Lean the bubble towards the middle of the screen so it never runs off the edge.
                petX.get() + PET / 2 > w / 2 ? 'right-0 text-right' : 'left-0 text-left',
              )}
            >
              {bubble}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

/** A small burst of hearts that floats up whenever `burst` changes. */
function Hearts({ burst }: { burst: number }) {
  if (burst === 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
      {[-26, -8, 10, 26, 0].map((dx, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute left-1/2 top-2 size-4"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], x: dx, y: -46 - i * 9, scale: [0.4, 1, 0.8] }}
          transition={{ duration: 1.1 + i * 0.08, ease: 'easeOut', delay: i * 0.05 }}
        >
          <path
            d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.5 1.2 4.3 2.4.8-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
            fill={i % 2 ? 'oklch(0.75 0.15 355)' : 'oklch(0.72 0.14 300)'}
          />
        </motion.svg>
      ))}
    </div>
  )
}

/** Pastel play ball. */
function PlayBall() {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full drop-shadow-md" aria-hidden>
      <defs>
        <radialGradient id="hn-ball" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="0.55" stopColor="#ffc9a8" />
          <stop offset="1" stopColor="#f59ab5" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#hn-ball)" />
      <path d="M4 15c7 3 9 10 6 20M36 25c-7-3-9-10-6-20" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".9" />
      <circle cx="14" cy="12" r="3.5" fill="#fff" opacity=".55" />
    </svg>
  )
}
