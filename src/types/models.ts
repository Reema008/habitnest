/**
 * App-level domain types built on top of the generated database types.
 */
import type { Enums, Json, Tables } from './database'

export type Profile = Tables<'profiles'>
export type UserSettings = Tables<'user_settings'>
export type Family = Tables<'families'>
export type FamilyMember = Tables<'family_members'>
export type FamilyInvitation = Tables<'family_invitations'>
export type Habit = Tables<'habits'>
export type FieldDefinition = Tables<'habit_field_definitions'>
export type HabitEntry = Tables<'habit_entries'>
export type ScheduleItem = Tables<'schedules'>
export type Achievement = Tables<'achievements'>
export type UserAchievement = Tables<'user_achievements'>
export type FamilyChallenge = Tables<'family_challenges'>
export type ChallengeParticipant = Tables<'challenge_participants'>
export type AppNotification = Tables<'notifications'>

export type FieldType = Enums<'field_type'>
export type HabitVisibility = Enums<'habit_visibility'>
export type GoalOperator = Enums<'goal_operator'>
export type PetType = Enums<'pet_type'>
export type ThemeMode = Enums<'theme_mode'>
export type FamilyRole = Enums<'family_role'>

/** Values stored in habit_entries.field_values, keyed by field_key. */
export type FieldValue = number | string
export type FieldValues = Record<string, FieldValue>

/** Validation rules a field may define (subset enforced again by the database). */
export type FieldValidation = {
  min?: number
  max?: number
  integer?: boolean
  maxLength?: number
}

/** A field as edited in the habit builder / sent to create_habit & save_habit_fields. */
export type FieldDraft = {
  field_key: string
  label: string
  field_type: FieldType
  unit?: string | null
  options: string[]
  required: boolean
  validation: FieldValidation
}

export type GoalDraft = {
  field_key: string
  operator: GoalOperator
  value: number | string
} | null

/** A habit together with the field definitions of its *current* version. */
export type HabitWithFields = Habit & { fields: FieldDefinition[] }

/** Family member joined with their profile. */
export type FamilyMemberWithProfile = FamilyMember & { profile: Profile }

export type { Json }

export const HABIT_COLORS = ['lavender', 'peach', 'mint', 'sky', 'rose', 'lemon'] as const
export type HabitColor = (typeof HABIT_COLORS)[number]

export const PET_TYPES: PetType[] = ['kitty', 'bunny', 'teddy', 'dino', 'axolotl']
export const PET_NAMES: Record<PetType, string> = {
  kitty: 'Kawaii Kitty',
  bunny: 'Baby Bunny',
  teddy: 'Teddy Bear',
  dino: 'Baby Dinosaur',
  axolotl: 'Baby Axolotl',
}
