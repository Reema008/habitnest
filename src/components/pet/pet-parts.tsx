/**
 * Inline-SVG artwork for the five companions (viewBox 0 0 200 200).
 * Chibi plush proportions: a big soft head, a small chubby body, stubby paws and feet.
 * Fur edges are scalloped "cloud" outlines shaded with radial gradients (ids are namespaced per
 * <Pet> instance via `uid`, see <PetDefs>).
 *
 * Each species is split into separable parts so <Pet> can animate them independently:
 * back (tail/fin) · body · belly · feet · arms · head (+ ears/gills/crest behind it, muzzle/nose in front) · face.
 */
import { motion } from 'motion/react'
import type { PetType } from '@/types/models'
import { PET_ARMS, PET_FACES, PET_PALETTES, type PetExpression } from './pet-config'

type PartProps = { type: PetType; uid: string }

/** Outline width: thin, in a deep tone of each pet's own hue. */
const SW = 2.4
const MOUTH_FILL = '#6a2f4a'
const TONGUE = '#f48fab'
const WHITE = '#ffffff'
/** Mirror around the vertical centre line (x = 100). */
const MIRROR = 'matrix(-1 0 0 1 200 0)'

const f = (n: number) => Number(n.toFixed(1))
const url = (uid: string, name: string) => `url(#${uid}-${name})`

type Pt = [number, number]
const at = (cx: number, cy: number, rx: number, ry: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
}
const pt = (p: Pt) => `${f(p[0])} ${f(p[1])}`

/** Smooth weight in [0, 1] peaking at `center` degrees and fading to 0 at ±`width`. */
function near(deg: number, center: number, width: number): number {
  const diff = Math.abs((((deg - center) % 360) + 540) % 360 - 180)
  return diff >= width ? 0 : Math.cos((diff / width) * (Math.PI / 2))
}

/**
 * A fluffy "cloud" ellipse: `n` soft scallops bulging outward by about `depth` (constant or per angle;
 * 0° = right, 90° = down).
 */
function fluff(cx: number, cy: number, rx: number, ry: number, n: number, depth: number | ((deg: number) => number)): string {
  const step = 360 / n
  const start = -90 + step / 2
  let d = `M${pt(at(cx, cy, rx, ry, start))}`
  for (let i = 0; i < n; i++) {
    const a0 = start + i * step
    const mid = a0 + step / 2
    const dd = typeof depth === 'number' ? depth : depth(((mid % 360) + 360) % 360)
    d += ` Q${pt(at(cx, cy, rx + dd * 2, ry + dd * 2, mid))} ${pt(at(cx, cy, rx, ry, a0 + step))}`
  }
  return `${d}Z`
}

/** A soft rounded spike (dome) standing on the segment p1→p2, bulging to its left (up when p1 is left of p2). */
function dome(p1: Pt, p2: Pt, h: number): string {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const len = Math.hypot(dx, dy)
  const nx = dy / len
  const ny = -dx / len
  const k = h * 1.33
  const c1: Pt = [p1[0] + nx * k + dx * 0.18, p1[1] + ny * k + dy * 0.18]
  const c2: Pt = [p2[0] + nx * k - dx * 0.18, p2[1] + ny * k - dy * 0.18]
  return `M${pt(p1)} C${pt(c1)} ${pt(c2)} ${pt(p2)}Z`
}

/* ---------------------------------------------------------------- geometry */

type Oval = { cx: number; cy: number; rx: number; ry: number }

const HEAD: Record<PetType, Oval> = {
  kitty: { cx: 100, cy: 88, rx: 60, ry: 51 },
  bunny: { cx: 100, cy: 90, rx: 58, ry: 50 },
  teddy: { cx: 100, cy: 88, rx: 60, ry: 52 },
  dino: { cx: 100, cy: 89, rx: 58, ry: 51 },
  axolotl: { cx: 100, cy: 90, rx: 65, ry: 49 },
}
const BODY: Oval = { cx: 100, cy: 161, rx: 45, ry: 32 }

/** Cheek tufts: deeper scallops low on both sides, gentle elsewhere. */
const cheekFluff = (deg: number) => 1.1 + 2.6 * (near(deg, 28, 42) + near(deg, 152, 42)) + 0.6 * near(deg, 270, 50)

const HEAD_PATH: Record<PetType, string | null> = {
  kitty: fluff(100, 88, 60, 51, 26, cheekFluff),
  bunny: fluff(100, 90, 58, 50, 24, cheekFluff),
  teddy: fluff(100, 88, 60, 52, 30, 1.3),
  dino: null,
  axolotl: null,
}

const FURRY_BODY = fluff(BODY.cx, BODY.cy, BODY.rx, BODY.ry, 18, (deg) => 1.6 - 0.9 * near(deg, 90, 50))
const FURRY_BELLY = fluff(100, 165, 26, 21, 13, 1.3)
/** Chest tuft peeking out under the chin: soft downward fur points. */
const CHEST_TUFT = 'M76 132 C 80 145 86 150 90 144 C 93 152 97 156 100 149 C 103 156 107 152 110 144 C 114 150 120 145 124 132 Z'

/* ---------------------------------------------------------------- defs */

/** Gradients for one pet instance. Render once inside the <svg>, before the parts. */
export function PetDefs({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  return (
    <defs>
      <radialGradient id={`${uid}-fur`} cx="0.42" cy="0.36" r="0.74" fx="0.4" fy="0.3">
        <stop offset="0" stopColor={p.light} />
        <stop offset="0.5" stopColor={p.fur} />
        <stop offset="1" stopColor={p.shade} />
      </radialGradient>
      <radialGradient id={`${uid}-belly`} cx="0.5" cy="0.38" r="0.7">
        <stop offset="0" stopColor={WHITE} />
        <stop offset="0.6" stopColor={p.belly} />
        <stop offset="1" stopColor={p.belly} />
      </radialGradient>
      <radialGradient id={`${uid}-inner`} cx="0.5" cy="0.7" r="0.75">
        <stop offset="0" stopColor={p.inner} stopOpacity={0.55} />
        <stop offset="1" stopColor={p.inner} />
      </radialGradient>
      <radialGradient id={`${uid}-extra`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor={p.extraLight} />
        <stop offset="1" stopColor={p.extra} />
      </radialGradient>
      <radialGradient id={`${uid}-cheek`}>
        <stop offset="0" stopColor={p.cheek} stopOpacity={0.85} />
        <stop offset="0.55" stopColor={p.cheek} stopOpacity={0.5} />
        <stop offset="1" stopColor={p.cheek} stopOpacity={0} />
      </radialGradient>
      <linearGradient id={`${uid}-eye`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a1826" />
        <stop offset="0.55" stopColor="#3b2236" />
        <stop offset="1" stopColor="#704262" />
      </linearGradient>
    </defs>
  )
}

/* ---------------------------------------------------------------- back */

const KITTY_TAIL = 'M122 186 C 162 196 188 172 179 146 C 174 131 157 130 155 142'
const KITTY_TAIL_TIP = 'M179 146 C 174 131 157 130 155 142'
const BUNNY_TAIL = fluff(146, 180, 13, 12, 9, 1.8)
const DINO_TAIL = 'M124 178 C 148 179 170 170 184 150 C 192 166 182 188 150 193 C 138 195 128 191 124 186 Z'
const DINO_TAIL_SPIKES = [dome([144, 177], [156, 175], 8), dome([160, 172], [171, 165], 7), dome([173, 162], [181, 153], 5.5)]
const AXO_TAIL = 'M122 177 C 148 176 168 166 183 146 C 192 164 182 188 150 193 C 138 195 128 191 122 186 Z'

/** Tail / fin drawn behind the body. */
export function PetBack({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty':
      return (
        <g fill="none" strokeLinecap="round">
          <path d={KITTY_TAIL} stroke={p.line} strokeWidth={17} />
          <path d={KITTY_TAIL} stroke={p.fur} strokeWidth={12.2} />
          <path d={KITTY_TAIL_TIP} stroke={p.extra} strokeWidth={12.2} />
        </g>
      )
    case 'bunny':
      return <path d={BUNNY_TAIL} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} strokeLinejoin="round" />
    case 'teddy':
      return null
    case 'dino':
      return (
        <g strokeLinejoin="round">
          {DINO_TAIL_SPIKES.map((d) => (
            <path key={d} d={d} fill={url(uid, 'extra')} stroke={p.line} strokeWidth={2} />
          ))}
          <path d={DINO_TAIL} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
        </g>
      )
    case 'axolotl':
      return (
        <g strokeLinejoin="round">
          <path d={AXO_TAIL} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
          <path d="M140 186 C 160 183 174 172 182 157" fill="none" stroke={p.extraLight} strokeWidth={4} strokeLinecap="round" />
        </g>
      )
  }
}

/* ---------------------------------------------------------------- head back: ears, gills, crest */

const KITTY_EAR = 'M45 70 C 41 46 43 24 51 14 C 55 9 62 9 67 13 C 79 22 91 30 99 42 Z'
const KITTY_EAR_INNER = 'M56 58 C 54 44 55 30 58 23 C 60 20 64 20 67 23 C 74 30 81 36 88 45 Z'
const KITTY_EAR_FLUFF = ['M60 54 q0 -9 3 -15', 'M66 54 q2 -7 6 -11', 'M55 56 q-1 -6 0 -11']

/** The right ear is soft and flops over to the side. */
const BUNNY_EAR_FLOPPY = 'M110 62 C 106 40 110 18 126 9 C 141 1 163 4 176 15 C 185 22 184 35 173 37 C 162 39 152 31 144 33 C 138 35 136 47 137 62 Z'
const BUNNY_EAR_FLOPPY_INNER = 'M118 56 C 116 40 119 24 130 17 C 142 10 158 13 168 22 C 160 25 151 22 143 25 C 133 28 128 40 128 56 Z'

const TEDDY_EAR = fluff(54, 50, 19, 19, 12, 1.3)

const DINO_CREST = (() => {
  const { cx, cy, rx, ry } = HEAD.dino
  const spikes: [number, number][] = [
    [-148, 9],
    [-121, 12.5],
    [-90, 15],
    [-59, 12.5],
    [-32, 9],
  ]
  return spikes.map(([deg, h]) => {
    const s = h * 0.75
    return dome(at(cx, cy, rx - 2, ry - 2, deg - s), at(cx, cy, rx - 2, ry - 2, deg + s), h)
  })
})()

/** Gill branches on the left side (anchor, angle, length factor); the right side is mirrored. */
const GILLS: { x: number; y: number; deg: number; len: number }[] = [
  { x: 56, y: 62, deg: -136, len: 1 },
  { x: 45, y: 77, deg: -164, len: 1.1 },
  { x: 44, y: 94, deg: 168, len: 0.95 },
]
const GILL_PATHS = GILLS.map((g) => {
  const rx = 15.5 * g.len
  return { ...g, rx, d: fluff(rx + 2, 0, rx, 7.6, 16, 1.6) }
})

function GillSide({ uid, line, light }: { uid: string; line: string; light: string }) {
  return (
    <g>
      {GILL_PATHS.map((g) => (
        <g key={g.deg} transform={`translate(${g.x} ${g.y}) rotate(${g.deg})`}>
          <path d={g.d} fill={url(uid, 'extra')} stroke={line} strokeWidth={2} strokeLinejoin="round" />
          <path d={`M4 0 L${f(g.rx * 2 - 2)} 0`} stroke={light} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
        </g>
      ))}
    </g>
  )
}

/** Ears, gills or crest: behind the head, moving with it. */
export function PetHeadBack({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty': {
      const ear = (
        <g strokeLinejoin="round">
          <path d={KITTY_EAR} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
          <path d={KITTY_EAR_INNER} fill={url(uid, 'inner')} />
          <g fill="none" stroke={p.light} strokeWidth={2.2} strokeLinecap="round">
            {KITTY_EAR_FLUFF.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </g>
      )
      return (
        <g>
          {ear}
          <g transform={MIRROR}>{ear}</g>
        </g>
      )
    }
    case 'bunny':
      return (
        <g strokeLinejoin="round">
          <g transform="rotate(-9 80 40)">
            <ellipse cx={80} cy={36} rx={15} ry={35} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
            <ellipse cx={80} cy={40} rx={7.5} ry={25} fill={url(uid, 'inner')} />
          </g>
          <path d={BUNNY_EAR_FLOPPY} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
          <path d={BUNNY_EAR_FLOPPY_INNER} fill={url(uid, 'inner')} />
        </g>
      )
    case 'teddy': {
      const ear = (
        <g>
          <path d={TEDDY_EAR} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx={56} cy={52} r={10.5} fill={url(uid, 'belly')} />
        </g>
      )
      return (
        <g>
          {ear}
          <g transform={MIRROR}>{ear}</g>
        </g>
      )
    }
    case 'dino':
      return (
        <g strokeLinejoin="round">
          {DINO_CREST.map((d) => (
            <path key={d} d={d} fill={url(uid, 'extra')} stroke={p.line} strokeWidth={2} />
          ))}
        </g>
      )
    case 'axolotl':
      return (
        <g>
          <GillSide uid={uid} line={p.line} light={p.extraLight} />
          <g transform={MIRROR}>
            <GillSide uid={uid} line={p.line} light={p.extraLight} />
          </g>
        </g>
      )
  }
}

/* ---------------------------------------------------------------- head */

export function PetHeadShape({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  const path = HEAD_PATH[type]
  const h = HEAD[type]
  return (
    <g>
      {path ? (
        <path d={path} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} strokeLinejoin="round" />
      ) : (
        <ellipse cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
      )}
      {/* soft sheen on the forehead */}
      <ellipse cx={h.cx - h.rx * 0.36} cy={h.cy - h.ry * 0.5} rx={h.rx * 0.2} ry={h.ry * 0.12} transform={`rotate(-24 ${h.cx - h.rx * 0.36} ${h.cy - h.ry * 0.5})`} fill={WHITE} opacity={path ? 0.18 : 0.42} />
    </g>
  )
}

/** Muzzle, nose and markings on top of the head (below the eyes and mouth). */
export function PetHeadFront({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  switch (type) {
    case 'kitty':
      return (
        <g>
          <g stroke={p.extra} strokeWidth={4} strokeLinecap="round">
            <path d="M91 41 v7" />
            <path d="M100 39 v9" />
            <path d="M109 41 v7" />
          </g>
          <path d="M96 102 Q100 100.4 104 102 Q102.6 105.8 100 106.2 Q97.4 105.8 96 102 Z" fill={p.inner} stroke={p.line} strokeWidth={1.3} strokeLinejoin="round" />
          <g fill={p.line} opacity={0.5}>
            <circle cx={84} cy={104} r={1.4} />
            <circle cx={81} cy={109} r={1.4} />
            <circle cx={87} cy={109.5} r={1.4} />
            <circle cx={116} cy={104} r={1.4} />
            <circle cx={119} cy={109} r={1.4} />
            <circle cx={113} cy={109.5} r={1.4} />
          </g>
        </g>
      )
    case 'bunny':
      return (
        <g>
          <ellipse cx={100} cy={104.5} rx={3.6} ry={2.6} fill={p.inner} stroke={p.line} strokeWidth={1.2} />
          <path d="M100 107 v2" stroke={p.line} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )
    case 'teddy':
      return (
        <g>
          <ellipse cx={100} cy={110} rx={21} ry={15.5} fill={url(uid, 'belly')} stroke={p.line} strokeOpacity={0.35} strokeWidth={1.6} />
          <path d="M93 103.5 Q100 99.5 107 103.5 Q106 109.5 100 110.5 Q94 109.5 93 103.5 Z" fill={p.line} />
          <ellipse cx={97.6} cy={103.6} rx={2.2} ry={1.1} fill={WHITE} opacity={0.75} />
          <path d="M100 110 v3" stroke={p.line} strokeWidth={2} strokeLinecap="round" />
          {/* little neck bow */}
          <g fill={url(uid, 'extra')} stroke={p.line} strokeWidth={1.6} strokeLinejoin="round">
            <path d="M100 140 C 92 131 82 133 82 140 C 82 147 92 149 100 140 Z" />
            <path d="M100 140 C 108 131 118 133 118 140 C 118 147 108 149 100 140 Z" />
            <ellipse cx={100} cy={140} rx={4} ry={3.6} />
          </g>
        </g>
      )
    case 'dino':
      return (
        <g>
          <g fill={p.shade} opacity={0.75}>
            <circle cx={70} cy={60} r={6} />
            <circle cx={60} cy={74} r={3.5} />
            <circle cx={132} cy={57} r={4.5} />
            <circle cx={142} cy={70} r={3} />
          </g>
          <ellipse cx={95.5} cy={104} rx={1.6} ry={1.3} fill={p.line} />
          <ellipse cx={104.5} cy={104} rx={1.6} ry={1.3} fill={p.line} />
        </g>
      )
    case 'axolotl':
      return (
        <g fill={p.shade} opacity={0.8}>
          <circle cx={84} cy={58} r={3.2} />
          <circle cx={94} cy={52} r={2.2} />
          <circle cx={116} cy={55} r={2.8} />
        </g>
      )
  }
}

/* ---------------------------------------------------------------- belly */

const DINO_SCALES = ['M80 156 Q100 162 120 156', 'M78 166 Q100 173 122 166', 'M82 176 Q100 182 118 176']

/** Belly, chest fluff and the soft shadow the big head casts on the body. */
export function PetBelly({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  const furry = type === 'kitty' || type === 'bunny' || type === 'teddy'
  return (
    <g>
      {furry ? (
        <>
          <path d={FURRY_BELLY} fill={url(uid, 'belly')} />
          <path d={CHEST_TUFT} fill={p.belly} />
        </>
      ) : (
        <>
          <ellipse cx={100} cy={166} rx={28} ry={23} fill={url(uid, 'belly')} />
          {type === 'dino' ? (
            <g fill="none" stroke={p.line} strokeOpacity={0.22} strokeWidth={1.8} strokeLinecap="round">
              {DINO_SCALES.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          ) : null}
        </>
      )}
      <ellipse cx={100} cy={134} rx={38} ry={7} fill={p.line} opacity={0.12} />
    </g>
  )
}

/* ---------------------------------------------------------------- face */

function OpenEye({ x, y, s, uid }: { x: number; y: number; s: number; uid: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={7.8 * s} ry={9.2 * s} fill={url(uid, 'eye')} />
      <circle cx={x + 2.5 * s} cy={y - 3.4 * s} r={3 * s} fill={WHITE} />
      <circle cx={x - 2.8 * s} cy={y + 3.5 * s} r={1.4 * s} fill={WHITE} opacity={0.9} />
    </g>
  )
}

/** Closed, happy eye: a soft upward arch. */
function HappyEye({ x, y, color }: { x: number; y: number; color: string }) {
  return <path d={`M${x - 7} ${y + 2} Q${x} ${y - 7} ${x + 7} ${y + 2}`} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
}

function Mouth({ type, grin }: { type: PetType; grin: boolean }) {
  const face = PET_FACES[type]
  const p = PET_PALETTES[type]
  const y = face.mouthY
  if (grin) {
    const h = face.mouth === 'wide' ? 12 : 7.5
    const top = y - 1
    const depth = h * 1.5
    const d = `M${100 - h} ${top} Q100 ${top - 1.5} ${100 + h} ${top} C${100 + h} ${top + depth * 0.75} ${100 + h * 0.4} ${top + depth} 100 ${top + depth} C${100 - h * 0.4} ${top + depth} ${100 - h} ${top + depth * 0.75} ${100 - h} ${top}Z`
    return (
      <g>
        <path d={d} fill={MOUTH_FILL} stroke={p.line} strokeWidth={2} strokeLinejoin="round" />
        <ellipse cx={100} cy={top + depth * 0.72} rx={h * 0.52} ry={depth * 0.22} fill={TONGUE} />
      </g>
    )
  }
  const d =
    face.mouth === 'w'
      ? `M93 ${y} q3.5 4.2 7 0 q3.5 4.2 7 0`
      : face.mouth === 'wide'
        ? `M86 ${y} q14 10 28 0`
        : `M95 ${y} q5 5 10 0`
  return <path d={d} fill="none" stroke={p.line} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
}

/** Eyes, cheeks and mouth for the given expression. `blink` only affects open eyes. */
export function PetFace({ type, uid, expression, blink }: PartProps & { expression: PetExpression; blink: boolean }) {
  const face = PET_FACES[type]
  const p = PET_PALETTES[type]
  const [lx, ly] = face.eyeL
  const [rx, ry] = face.eyeR
  const s = face.eyeScale
  const blinkAnim = { scaleY: blink ? 0.12 : 1 }
  const blinkTransition = { duration: 0.07 }
  return (
    <g>
      <ellipse cx={100 - face.cheekDx} cy={face.cheekY} rx={11} ry={7} fill={url(uid, 'cheek')} />
      <ellipse cx={100 + face.cheekDx} cy={face.cheekY} rx={11} ry={7} fill={url(uid, 'cheek')} />
      {expression === 'grin' ? (
        <>
          <HappyEye x={lx} y={ly} color={p.line} />
          <HappyEye x={rx} y={ry} color={p.line} />
        </>
      ) : (
        <>
          <motion.g animate={blinkAnim} transition={blinkTransition}>
            <OpenEye x={lx} y={ly} s={s} uid={uid} />
          </motion.g>
          {expression === 'wink' ? (
            <HappyEye x={rx} y={ry} color={p.line} />
          ) : (
            <motion.g animate={blinkAnim} transition={blinkTransition}>
              <OpenEye x={rx} y={ry} s={s} uid={uid} />
            </motion.g>
          )}
        </>
      )}
      <Mouth type={type} grin={expression === 'grin'} />
    </g>
  )
}

/* ---------------------------------------------------------------- arms, body, feet */

/** Stubby paw. */
export function PetArm({ type, uid, side }: PartProps & { side: 'left' | 'right' }) {
  const p = PET_PALETTES[type]
  const a = PET_ARMS[type]
  const arm = (
    <ellipse cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} transform={`rotate(${a.rot} ${a.cx} ${a.cy})`} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
  )
  return side === 'left' ? arm : <g transform={MIRROR}>{arm}</g>
}

export function PetBody({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  const furry = type === 'kitty' || type === 'bunny' || type === 'teddy'
  return furry ? (
    <path d={FURRY_BODY} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} strokeLinejoin="round" />
  ) : (
    <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
  )
}

/** Little feet poking forward, with toe beans (or claws for the dino). */
export function PetFeet({ type, uid }: PartProps) {
  const p = PET_PALETTES[type]
  const foot = (x: number) => (
    <g key={x}>
      <ellipse cx={x} cy={186} rx={13.5} ry={9.5} fill={url(uid, 'fur')} stroke={p.line} strokeWidth={SW} />
      {type === 'dino' ? (
        <g fill={p.belly}>
          <circle cx={x - 6} cy={190.5} r={2.2} />
          <circle cx={x} cy={192} r={2.2} />
          <circle cx={x + 6} cy={190.5} r={2.2} />
        </g>
      ) : type === 'axolotl' ? null : (
        <g fill={url(uid, 'inner')}>
          <ellipse cx={x} cy={188.4} rx={5.4} ry={3.8} />
          <circle cx={x - 5.4} cy={183} r={2} />
          <circle cx={x} cy={181.4} r={2} />
          <circle cx={x + 5.4} cy={183} r={2} />
        </g>
      )}
    </g>
  )
  return <g>{[79, 121].map(foot)}</g>
}
