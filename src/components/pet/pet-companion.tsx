import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion } from 'motion/react'
import { clampPoint, randomItem, type Bounds } from '@/domain/pet-companion'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/providers/auth-provider'
import { usePrefs } from '@/store/prefs'
import { PET_NAMES, type PetType } from '@/types/models'
import { petGreeting } from './greetings'
import { Pet, type PetExpression, type PetGesture } from './pet'

const PET = 84 // px
const TAB_BAR = 100 // keep clear of the bottom navigation
const EDGE = 6

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

/** Floating pet that keeps you company on every screen. Tap for a trick; drag to move it. */
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

  const bounds: Bounds = { minX: EDGE, minY: EDGE, maxX: w - PET - EDGE, maxY: h - PET - TAB_BAR + 12 }
  const start = clampPoint(saved ?? { x: w - PET - 14, y: h - PET - TAB_BAR - 8 }, bounds)
  const petX = useMotionValue(start.x)
  const petY = useMotionValue(start.y)
  const body = useAnimationControls()

  const [busy, setBusy] = useState(false)
  const [gesture, setGesture] = useState<PetGesture | null>(null)
  const [gestureKey, setGestureKey] = useState(0)
  const [expression, setExpression] = useState<PetExpression | undefined>(undefined)
  const [bubble, setBubble] = useState<string | null>(null)
  const [hearts, setHearts] = useState(0)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Keep the pet on screen when the window changes size.
  useEffect(() => {
    const p = clampPoint({ x: petX.get(), y: petY.get() }, bounds)
    petX.set(p.x)
    petY.set(p.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h])

  const say = (text: string, ms = 2200) => {
    clearTimeout(bubbleTimer.current)
    setBubble(text)
    bubbleTimer.current = setTimeout(() => setBubble(null), ms)
  }
  useEffect(() => () => clearTimeout(bubbleTimer.current), [])

  const playGesture = (g: PetGesture) => {
    setGesture(g)
    setGestureKey((k) => k + 1)
  }

  // Say hello once per session.
  useEffect(() => {
    if (greetedThisSession) return
    greetedThisSession = true
    const t = setTimeout(() => {
      say(petGreeting(displayName), 5000)
      playGesture('wave')
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trick = async () => {
    if (busy) return
    setBusy(true)
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
    setTimeout(() => {
      setExpression(undefined)
      setBusy(false)
    }, 900)
  }

  const name = PET_NAMES[type]
  const onRight = petX.get() + PET / 2 > w / 2
  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-live="polite">
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`${name}. Tap for a trick, or drag to move.`}
        className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none select-none rounded-full focus-visible:outline-3 focus-visible:outline-ring active:cursor-grabbing"
        style={{ x: petX, y: petY, width: PET, height: PET }}
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY }}
        onDragStart={() => setBubble(null)}
        onDragEnd={() => savePosition({ x: petX.get(), y: petY.get() })}
        onTap={() => void trick()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void trick()
          }
        }}
      >
        <span className="absolute -bottom-1 left-1/2 h-2.5 w-14 -translate-x-1/2 rounded-full bg-foreground/15 blur-[2px]" aria-hidden />
        <motion.div animate={body} className="relative h-full w-full">
          <Pet type={type} size={PET} gesture={gesture} gestureKey={gestureKey} expression={expression} label="" />
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
                'glass absolute bottom-full mb-1 w-max max-w-48 rounded-2xl px-3 py-1.5 text-xs font-semibold',
                // Lean the bubble towards the middle of the screen so it never runs off the edge.
                onRight ? 'right-0 text-right' : 'left-0 text-left',
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
