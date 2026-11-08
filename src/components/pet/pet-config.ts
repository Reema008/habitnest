import type { PetType } from '@/types/models'

/** Just-for-fun gestures. Pets have no needs, moods or stats — they only say hello. */
export type PetGesture = 'wave' | 'bounce' | 'nod'
export type PetExpression = 'smile' | 'grin' | 'wink'

export const PET_GESTURES: readonly PetGesture[] = ['wave', 'bounce', 'nod']

export const GESTURE_LABELS: Record<PetGesture, string> = { wave: 'Wave', bounce: 'Bounce', nod: 'Nod' }

/** How long each gesture plays (ms). */
export const GESTURE_DURATION_MS: Record<PetGesture, number> = { wave: 1600, bounce: 900, nod: 1100 }

/** Soft, slightly muted pastels. Each part is shaded with a radial gradient from `light` → `fur` → `shade`. */
export type PetPalette = {
  /** Highlight at the centre of furry parts. */
  light: string
  fur: string
  /** Darker rim of furry parts. */
  shade: string
  /** Thin outline, a deep tone of the same hue. */
  line: string
  /** Inner ears, paw pads, nose. */
  inner: string
  /** Belly / chest fluff / muzzle. */
  belly: string
  cheek: string
  /** Species accent: tabby marks, bow, spikes, gills. */
  extra: string
  extraLight: string
}

export const PET_PALETTES: Record<PetType, PetPalette> = {
  kitty: {
    light: '#fffaf5',
    fur: '#fbe8da',
    shade: '#efc6ad',
    line: '#9c6a58',
    inner: '#f5b3bf',
    belly: '#fffaf6',
    cheek: '#f59aaa',
    extra: '#f0b98f',
    extraLight: '#f8d3b4',
  },
  bunny: {
    light: '#ffffff',
    fur: '#f6f2fc',
    shade: '#dcd3ef',
    line: '#7f70a3',
    inner: '#f7bfd2',
    belly: '#ffffff',
    cheek: '#f5a3c0',
    extra: '#ffffff',
    extraLight: '#ffffff',
  },
  teddy: {
    light: '#f4d6b6',
    fur: '#e2b48a',
    shade: '#c48d64',
    line: '#7d5038',
    inner: '#f6e3cd',
    belly: '#f7e7d4',
    cheek: '#ef9a8c',
    extra: '#e59aa6',
    extraLight: '#f4c1c8',
  },
  dino: {
    light: '#e9f7ed',
    fur: '#bfe2ca',
    shade: '#90c4a3',
    line: '#4a7a62',
    inner: '#f7c0a8',
    belly: '#fbf1d2',
    cheek: '#f3a59f',
    extra: '#f5b49c',
    extraLight: '#fbd6c3',
  },
  axolotl: {
    light: '#fff2f7',
    fur: '#f9cddd',
    shade: '#eaa5c0',
    line: '#a9567a',
    inner: '#f6aac4',
    belly: '#fdeaf1',
    cheek: '#f088aa',
    extra: '#ec86ad',
    extraLight: '#f7bcd2',
  },
}

/** Face layout per species (viewBox 0 0 200 200). Eyes sit low and wide on the big head. */
export type FaceLayout = {
  eyeL: [number, number]
  eyeR: [number, number]
  eyeScale: number
  mouthY: number
  mouth: 'u' | 'w' | 'wide'
  cheekY: number
  cheekDx: number
}

const BASE_FACE: FaceLayout = { eyeL: [76, 97], eyeR: [124, 97], eyeScale: 1, mouthY: 108, mouth: 'u', cheekY: 109, cheekDx: 39 }

export const PET_FACES: Record<PetType, FaceLayout> = {
  kitty: { ...BASE_FACE, mouth: 'w', mouthY: 107 },
  bunny: { ...BASE_FACE, eyeL: [76, 99], eyeR: [124, 99], mouth: 'w', mouthY: 109, cheekY: 111 },
  teddy: { ...BASE_FACE, eyeL: [74, 94], eyeR: [126, 94], mouth: 'w', mouthY: 113, cheekY: 108, cheekDx: 42 },
  dino: { ...BASE_FACE, eyeL: [76, 98], eyeR: [124, 98], mouthY: 110, cheekY: 111 },
  axolotl: { ...BASE_FACE, eyeL: [72, 96], eyeR: [128, 96], mouth: 'wide', mouthY: 109, cheekY: 108, cheekDx: 45 },
}

/** Resting left paw (an oval rotated by `rot`°); the right paw is its mirror image. */
export type ArmGeometry = { cx: number; cy: number; rx: number; ry: number; rot: number }

export const PET_ARMS: Record<PetType, ArmGeometry> = {
  kitty: { cx: 62, cy: 157, rx: 11.5, ry: 14.5, rot: 24 },
  bunny: { cx: 62, cy: 157, rx: 11.5, ry: 14.5, rot: 24 },
  teddy: { cx: 62, cy: 157, rx: 12, ry: 15, rot: 24 },
  dino: { cx: 66, cy: 154, rx: 9, ry: 12, rot: 30 },
  axolotl: { cx: 63, cy: 156, rx: 10.5, ry: 13.5, rot: 26 },
}

/** Shoulder (top of the right paw, slightly inset) that the wave gesture rotates around. */
export function rightShoulder(type: PetType): [number, number] {
  const a = PET_ARMS[type]
  const r = (a.rot * Math.PI) / 180
  const reach = a.ry - 3
  return [200 - a.cx - reach * Math.sin(r), a.cy - reach * Math.cos(r)]
}

/** Short, friendly one-liners describing each companion (used by the picker). */
export const PET_BLURBS: Record<PetType, string> = {
  kitty: 'Curious and cuddly',
  bunny: 'Soft and bouncy',
  teddy: 'Warm and huggable',
  dino: 'Small but mighty',
  axolotl: 'Always smiling',
}

export function randomGesture(rng: () => number = Math.random): PetGesture {
  return PET_GESTURES[Math.floor(rng() * PET_GESTURES.length) % PET_GESTURES.length]!
}
