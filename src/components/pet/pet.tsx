import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion, type TargetAndTransition } from 'motion/react'
import { cn } from '@/lib/utils'
import { PET_NAMES, type PetType } from '@/types/models'
import { GESTURE_DURATION_MS, type PetExpression, type PetGesture } from './pet-config'
import { PetArm, PetBack, PetBelly, PetBody, PetFace, PetHeadBack, PetHeadFront, PetHeadShape } from './pet-parts'

export type { PetExpression, PetGesture } from './pet-config'

type PetProps = {
  type: PetType
  /** Gesture to play. Change `gestureKey` to replay the same gesture again. */
  gesture?: PetGesture | null
  gestureKey?: number
  /** Fixed expression. When omitted the pet smiles and occasionally grins or winks on its own. */
  expression?: PetExpression
  /** Rendered size in px (square). */
  size?: number
  className?: string
  /** Accessible name; pass '' when the pet is decorative (e.g. inside a labelled button). */
  label?: string
}

/**
 * Rotate/scale around a fixed point of the 200×200 artwork. Motion tracks originX/originY (fractions,
 * rendered as percentages); with transform-box: view-box they resolve against the viewBox.
 */
const pivot = (x: number, y: number) => ({ transformBox: 'view-box' as const, originX: x / 200, originY: y / 200 })

const seconds = (g: PetGesture) => GESTURE_DURATION_MS[g] / 1000
const WAVE: TargetAndTransition = { rotate: [0, -140, -105, -140, -105, -140, 0], transition: { duration: seconds('wave'), ease: 'easeInOut' } }
const BOUNCE: TargetAndTransition = { y: [0, -26, 0, -12, 0], scaleY: [1, 0.95, 1.04, 0.98, 1], transition: { duration: seconds('bounce'), ease: 'easeOut' } }
const NOD: TargetAndTransition = { y: [0, 7, 0, 7, 0], rotate: [0, 2, 0, -2, 0], transition: { duration: seconds('nod'), ease: 'easeInOut' } }
const BREATHE = { scaleY: [1, 1.03, 1], scaleX: [1, 0.992, 1] }

/**
 * Runs `callback` after a random delay in [min, max) ms, repeatedly, while enabled.
 * The callback may return a cleanup that runs on unmount.
 */
function useRandomInterval(callback: () => (() => void) | void, min: number, max: number, enabled: boolean) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    let cleanup: (() => void) | void
    const schedule = () => {
      timer = setTimeout(() => {
        cleanup = latest.current()
        schedule()
      }, min + Math.random() * (max - min))
    }
    schedule()
    return () => {
      clearTimeout(timer)
      if (cleanup) cleanup()
    }
  }, [min, max, enabled])
}

/**
 * A friendly companion drawn as inline SVG. It breathes, blinks and can wave, bounce or nod.
 * With reduced motion it stays still and only changes expression.
 */
export function Pet({ type, gesture = null, gestureKey = 0, expression, size = 160, className, label }: PetProps) {
  const reduce = useReducedMotion() ?? false
  const [blink, setBlink] = useState(false)
  const [autoExpression, setAutoExpression] = useState<PetExpression>('smile')
  const [finishedKey, setFinishedKey] = useState<string | null>(null)
  const bounce = useAnimationControls()
  const nod = useAnimationControls()
  const wave = useAnimationControls()

  const playKey = gesture ? `${gesture}:${gestureKey}` : null
  const active: PetGesture | null = playKey && playKey !== finishedKey ? gesture : null

  useEffect(() => {
    if (!playKey || !gesture) return
    if (!reduce) {
      const controls = gesture === 'bounce' ? bounce : gesture === 'nod' ? nod : wave
      const target = gesture === 'bounce' ? BOUNCE : gesture === 'nod' ? NOD : WAVE
      void controls.start(target)
    }
    const timer = setTimeout(() => setFinishedKey(playKey), GESTURE_DURATION_MS[gesture])
    return () => clearTimeout(timer)
  }, [playKey, gesture, reduce, bounce, nod, wave])

  useRandomInterval(
    () => {
      setBlink(true)
      const t = setTimeout(() => setBlink(false), 140)
      return () => clearTimeout(t)
    },
    2600,
    5600,
    !reduce,
  )

  useRandomInterval(
    () => {
      setAutoExpression(Math.random() < 0.5 ? 'grin' : 'wink')
      const t = setTimeout(() => setAutoExpression('smile'), 1500)
      return () => clearTimeout(t)
    },
    6000,
    11000,
    expression === undefined,
  )

  const shown: PetExpression = expression ?? (active ? (active === 'nod' ? 'smile' : 'grin') : autoExpression)
  const name = label ?? PET_NAMES[type]

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible select-none', className)}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      focusable="false"
    >
      <ellipse cx={100} cy={194} rx={46} ry={5.5} fill="#3a2a48" opacity={0.12} />
      <motion.g animate={bounce} style={pivot(100, 192)}>
        <motion.g
          animate={reduce ? undefined : BREATHE}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          style={pivot(100, 190)}
        >
          <PetBack type={type} />
          <PetBody type={type} />
          <PetBelly type={type} />
          <PetArm type={type} side="left" />
          <motion.g animate={nod} style={pivot(100, 132)}>
            <PetHeadBack type={type} />
            <PetHeadShape type={type} />
            <PetHeadFront type={type} />
            <PetFace type={type} expression={shown} blink={blink && !reduce} />
          </motion.g>
          <motion.g animate={wave} style={pivot(139, 136)}>
            <PetArm type={type} side="right" />
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  )
}
