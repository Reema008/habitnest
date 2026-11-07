import type { PetType } from '@/types/models'

/** Just-for-fun gestures. Pets have no needs, moods or stats — they only say hello. */
export type PetGesture = 'wave' | 'bounce' | 'nod'
export type PetExpression = 'smile' | 'grin' | 'wink'

export const PET_GESTURES: readonly PetGesture[] = ['wave', 'bounce', 'nod']

export const GESTURE_LABELS: Record<PetGesture, string> = { wave: 'Wave', bounce: 'Bounce', nod: 'Nod' }

/** How long each gesture plays (ms). */
export const GESTURE_DURATION_MS: Record<PetGesture, number> = { wave: 1600, bounce: 900, nod: 1100 }

export type PetPalette = {
  fur: string
  shade: string
  accent: string
  line: string
  cheek: string
}

export const PET_PALETTES: Record<PetType, PetPalette> = {
  kitty: { fur: '#f8dbe8', shade: '#efc3d7', accent: '#f4a6c2', line: '#6b4a63', cheek: '#f39ab9' },
  bunny: { fur: '#f4f0fb', shade: '#e1d9f2', accent: '#f7bfd3', line: '#5f5378', cheek: '#f5a9c4' },
  teddy: { fur: '#e9c6a2', shade: '#d9ae86', accent: '#f7e5d1', line: '#6e4f3a', cheek: '#f1a08f' },
  dino: { fur: '#bfe5cc', shade: '#a3d4b6', accent: '#fbecbc', line: '#3f6152', cheek: '#f4a7a0' },
  axolotl: { fur: '#fbc8da', shade: '#f3aec7', accent: '#fde7ef', line: '#7a3f5a', cheek: '#f28fb1' },
}

/** Face layout per species (viewBox 0 0 200 200). */
export type FaceLayout = {
  eyeL: [number, number]
  eyeR: [number, number]
  eyeScale: number
  mouthY: number
  mouth: 'u' | 'w' | 'wide'
  cheekY: number
  cheekDx: number
}

const BASE_FACE: FaceLayout = { eyeL: [82, 90], eyeR: [118, 90], eyeScale: 1, mouthY: 106, mouth: 'u', cheekY: 103, cheekDx: 31 }

export const PET_FACES: Record<PetType, FaceLayout> = {
  kitty: { ...BASE_FACE, mouth: 'w', mouthY: 105 },
  bunny: { ...BASE_FACE, mouth: 'w', mouthY: 105 },
  teddy: { ...BASE_FACE, eyeL: [80, 86], eyeR: [120, 86], mouthY: 110, cheekY: 100, cheekDx: 34 },
  dino: { ...BASE_FACE, mouthY: 107 },
  axolotl: { ...BASE_FACE, eyeL: [76, 90], eyeR: [124, 90], eyeScale: 0.9, mouth: 'wide', mouthY: 105, cheekDx: 38 },
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
