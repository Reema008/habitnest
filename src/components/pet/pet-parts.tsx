/**
 * Inline-SVG artwork for the five companions (viewBox 0 0 200 200).
 * Each species is split into separable parts so <Pet> can animate them independently:
 * back (tail/fin) · body · belly · arms · head (+ ears/gills/crest behind it, muzzle/nose in front) · face.
 */
import { motion } from 'motion/react'
import type { PetType } from '@/types/models'
import { PET_FACES, PET_PALETTES, type PetExpression } from './pet-config'

const SW = 3
const EYE = '#3a2a48'
const MOUTH_FILL = '#6b2d4a'
const TONGUE = '#f590ad'

const f = (n: number) => Number(n.toFixed(1))

/** A rounded triangular spike sitting on an ellipse edge, pointing outward at `deg`. */
function spikePath(cx: number, cy: number, rx: number, ry: number, deg: number, w: number, h: number): string {
  const a = (deg * Math.PI) / 180
  const nx = Math.cos(a)
  const ny = Math.sin(a)
  const bx = cx + (rx - 5) * nx
  const by = cy + (ry - 5) * ny
  const tx = -ny
  const ty = nx
  return `M${f(bx + tx * w)} ${f(by + ty * w)} L${f(bx + nx * h)} ${f(by + ny * h)} L${f(bx - tx * w)} ${f(by - ty * w)} Z`
}

const DINO_CREST = [-140, -115, -90, -65, -40].map((deg, i) =>
  spikePath(100, 88, 50, 46, deg, i === 2 ? 10 : 8.5, i === 2 ? 20 : 15),
)
const DINO_TAIL_SPIKES = [
  'M150 156 L158 143 L164 159 Z',
  'M166 162 L176 151 L178 168 Z',
]

const GILL_ANGLES_LEFT = [-150, 180, 150]
const GILL_ANGLES_RIGHT = [-30, 0, 30]

function Gill({ ax, ay, deg }: { ax: number; ay: number; deg: number }) {
  const a = (deg * Math.PI) / 180
  const cx = f(ax + Math.cos(a) * 15)
  const cy = f(ay + Math.sin(a) * 15)
  const tipX = f(ax + Math.cos(a) * 25)
  const tipY = f(ay + Math.sin(a) * 25)
  const p = PET_PALETTES.axolotl
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={15} ry={6.5} transform={`rotate(${deg} ${cx} ${cy})`} fill="#f283ab" stroke={p.line} strokeWidth={2.5} />
      <path d={`M${ax} ${ay} L${tipX} ${tipY}`} stroke="#d9608a" strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

/** Tail / fin drawn behind the body. */
export function PetBack({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty':
      return (
        <g>
          <path d="M134 170 C 170 176, 182 136, 160 120" fill="none" stroke={p.line} strokeWidth={15} strokeLinecap="round" />
          <path d="M134 170 C 170 176, 182 136, 160 120" fill="none" stroke={p.fur} strokeWidth={9} strokeLinecap="round" />
        </g>
      )
    case 'bunny':
      return <circle cx={144} cy={174} r={12} fill="#ffffff" stroke={p.line} strokeWidth={SW} />
    case 'teddy':
      return null
    case 'dino':
      return (
        <g strokeLinejoin="round">
          {DINO_TAIL_SPIKES.map((d) => (
            <path key={d} d={d} fill="#f7b9a0" stroke={p.line} strokeWidth={2.5} />
          ))}
          <path d="M130 154 Q 172 154 190 184 Q 158 192 128 180 Z" fill={p.fur} stroke={p.line} strokeWidth={SW} />
        </g>
      )
    case 'axolotl':
      return (
        <g strokeLinejoin="round">
          <path d="M130 152 Q 180 140 192 178 Q 162 194 128 180 Z" fill={p.shade} stroke={p.line} strokeWidth={SW} />
          <path d="M140 162 Q 168 158 180 176" fill="none" stroke={p.line} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        </g>
      )
  }
}

/** Ears, gills or crest: behind the head, moving with it. */
export function PetHeadBack({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty':
      return (
        <g strokeLinejoin="round">
          <path d="M56 74 L62 28 L98 48 Z" fill={p.fur} stroke={p.line} strokeWidth={SW} />
          <path d="M66 62 L69 39 L88 50 Z" fill={p.accent} />
          <path d="M144 74 L138 28 L102 48 Z" fill={p.fur} stroke={p.line} strokeWidth={SW} />
          <path d="M134 62 L131 39 L112 50 Z" fill={p.accent} />
        </g>
      )
    case 'bunny':
      return (
        <g>
          <g transform="rotate(-9 80 36)">
            <ellipse cx={80} cy={36} rx={14} ry={33} fill={p.fur} stroke={p.line} strokeWidth={SW} />
            <ellipse cx={80} cy={40} rx={6.5} ry={23} fill={p.accent} />
          </g>
          <g transform="rotate(9 120 36)">
            <ellipse cx={120} cy={36} rx={14} ry={33} fill={p.fur} stroke={p.line} strokeWidth={SW} />
            <ellipse cx={120} cy={40} rx={6.5} ry={23} fill={p.accent} />
          </g>
        </g>
      )
    case 'teddy':
      return (
        <g>
          <circle cx={58} cy={50} r={17} fill={p.fur} stroke={p.line} strokeWidth={SW} />
          <circle cx={58} cy={50} r={9} fill={p.accent} />
          <circle cx={142} cy={50} r={17} fill={p.fur} stroke={p.line} strokeWidth={SW} />
          <circle cx={142} cy={50} r={9} fill={p.accent} />
        </g>
      )
    case 'dino':
      return (
        <g strokeLinejoin="round">
          {DINO_CREST.map((d) => (
            <path key={d} d={d} fill="#f7b9a0" stroke={p.line} strokeWidth={2.5} />
          ))}
        </g>
      )
    case 'axolotl':
      return (
        <g>
          {GILL_ANGLES_LEFT.map((deg) => (
            <Gill key={`l${deg}`} ax={50} ay={86} deg={deg} />
          ))}
          {GILL_ANGLES_RIGHT.map((deg) => (
            <Gill key={`r${deg}`} ax={150} ay={86} deg={deg} />
          ))}
        </g>
      )
  }
}

export function PetHeadShape({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  if (type === 'axolotl') return <ellipse cx={100} cy={90} rx={56} ry={44} fill={p.fur} stroke={p.line} strokeWidth={SW} />
  if (type === 'dino') return <ellipse cx={100} cy={88} rx={50} ry={46} fill={p.fur} stroke={p.line} strokeWidth={SW} />
  return <circle cx={100} cy={88} r={48} fill={p.fur} stroke={p.line} strokeWidth={SW} />
}

/** Muzzle, nose, whiskers and markings on top of the head (below the eyes and mouth). */
export function PetHeadFront({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty':
      return (
        <g>
          <path d="M96.5 98 h7 l-3.5 4 z" fill={p.accent} stroke={p.line} strokeWidth={1.5} strokeLinejoin="round" />
          <g stroke={p.line} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round">
            <path d="M60 98 L40 94" />
            <path d="M60 105 L40 107" />
            <path d="M140 98 L160 94" />
            <path d="M140 105 L160 107" />
          </g>
        </g>
      )
    case 'bunny':
      return <path d="M96.5 98.5 q3.5 -3 7 0 q-3.5 4.5 -7 0 z" fill={p.accent} stroke={p.line} strokeWidth={1.5} strokeLinejoin="round" />
    case 'teddy':
      return (
        <g>
          <ellipse cx={100} cy={106} rx={19} ry={14} fill={p.accent} stroke={p.line} strokeOpacity={0.35} strokeWidth={2} />
          <ellipse cx={100} cy={99} rx={6} ry={4.2} fill={p.line} />
          <path d="M100 103 v4" stroke={p.line} strokeWidth={2} strokeLinecap="round" />
        </g>
      )
    case 'dino':
      return (
        <g fill={p.shade}>
          <circle cx={74} cy={62} r={5} />
          <circle cx={128} cy={58} r={4} />
          <circle cx={136} cy={70} r={3} />
          <circle cx={95} cy={100} r={1.7} fill={p.line} />
          <circle cx={105} cy={100} r={1.7} fill={p.line} />
        </g>
      )
    case 'axolotl':
      return (
        <g fill={p.shade}>
          <circle cx={86} cy={62} r={3.5} />
          <circle cx={112} cy={58} r={3} />
        </g>
      )
  }
}

export function PetBelly({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  const fill = type === 'kitty' ? '#fdf0f6' : type === 'bunny' ? '#ffffff' : p.accent
  return <ellipse cx={100} cy={158} rx={25} ry={21} fill={fill} />
}

function OpenEye({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={5.5 * s} ry={7 * s} fill={EYE} />
      <circle cx={x + 1.8 * s} cy={y - 2.6 * s} r={1.9 * s} fill="#ffffff" />
    </g>
  )
}

function HappyEye({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 6} ${y + 1.5} q6 -8 12 0`} fill="none" stroke={EYE} strokeWidth={3} strokeLinecap="round" />
}

function Mouth({ type, grin }: { type: PetType; grin: boolean }) {
  const face = PET_FACES[type]
  const p = PET_PALETTES[type]
  const y = face.mouthY
  if (grin) {
    const half = face.mouth === 'wide' ? 14 : 10
    return (
      <g>
        <path d={`M${100 - half} ${y - 1} q${half} ${half * 1.4} ${half * 2} 0 z`} fill={MOUTH_FILL} stroke={p.line} strokeWidth={2.5} strokeLinejoin="round" />
        <ellipse cx={100} cy={y + half * 0.45} rx={half * 0.45} ry={2.4} fill={TONGUE} />
      </g>
    )
  }
  const d =
    face.mouth === 'w'
      ? `M92 ${y} q4 4.5 8 0 q4 4.5 8 0`
      : face.mouth === 'wide'
        ? `M84 ${y} q16 10 32 0`
        : `M94 ${y} q6 6 12 0`
  return <path d={d} fill="none" stroke={p.line} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
}

/** Eyes, cheeks and mouth for the given expression. `blink` only affects open eyes. */
export function PetFace({ type, expression, blink }: { type: PetType; expression: PetExpression; blink: boolean }) {
  const face = PET_FACES[type]
  const p = PET_PALETTES[type]
  const [lx, ly] = face.eyeL
  const [rx, ry] = face.eyeR
  const s = face.eyeScale
  const blinkAnim = { scaleY: blink ? 0.12 : 1 }
  const blinkTransition = { duration: 0.07 }
  return (
    <g>
      <ellipse cx={100 - face.cheekDx} cy={face.cheekY} rx={7.5} ry={4.5} fill={p.cheek} opacity={0.55} />
      <ellipse cx={100 + face.cheekDx} cy={face.cheekY} rx={7.5} ry={4.5} fill={p.cheek} opacity={0.55} />
      {expression === 'grin' ? (
        <>
          <HappyEye x={lx} y={ly} />
          <HappyEye x={rx} y={ry} />
        </>
      ) : (
        <>
          <motion.g animate={blinkAnim} transition={blinkTransition}>
            <OpenEye x={lx} y={ly} s={s} />
          </motion.g>
          {expression === 'wink' ? (
            <HappyEye x={rx} y={ry} />
          ) : (
            <motion.g animate={blinkAnim} transition={blinkTransition}>
              <OpenEye x={rx} y={ry} s={s} />
            </motion.g>
          )}
        </>
      )}
      <Mouth type={type} grin={expression === 'grin'} />
    </g>
  )
}

/** Resting arm (left side of the image). */
export function PetArm({ type, side }: { type: PetType; side: 'left' | 'right' }) {
  const p = PET_PALETTES[type]
  const cx = side === 'left' ? 61 : 139
  const rot = side === 'left' ? 20 : -20
  return (
    <ellipse cx={cx} cy={152} rx={11} ry={18} transform={`rotate(${rot} ${cx} ${152})`} fill={p.fur} stroke={p.line} strokeWidth={SW} />
  )
}

export function PetBody({ type }: { type: PetType }) {
  const p = PET_PALETTES[type]
  return (
    <g>
      <ellipse cx={80} cy={183} rx={14} ry={9} fill={p.shade} stroke={p.line} strokeWidth={SW} />
      <ellipse cx={120} cy={183} rx={14} ry={9} fill={p.shade} stroke={p.line} strokeWidth={SW} />
      <ellipse cx={100} cy={150} rx={44} ry={37} fill={p.fur} stroke={p.line} strokeWidth={SW} />
    </g>
  )
}
