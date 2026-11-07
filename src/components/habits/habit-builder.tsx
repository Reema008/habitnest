import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ArrowLeft, Eye, Info, Lock, Plus, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { GlassCard } from '@/components/common/glass-card'
import { HabitIcon } from '@/components/common/habit-visuals'
import { useOnline } from '@/components/common/offline-banner'
import type { HabitDraftMeta } from '@/api/habits'
import { describeGoal, GOAL_OPERATOR_LABELS, isEntryComplete } from '@/domain/completion'
import { cn } from '@/lib/utils'
import type { FieldDraft, FieldType, FieldValues, GoalDraft, GoalOperator } from '@/types/models'
import {
  changeFieldType, cleanOptions, DESCRIPTION_MAX, emptyField, goalLikeFromDraft, isChoiceType, MAX_FIELDS, NAME_MAX,
  reconcileGoal, toFieldDrafts, toGoalDraft, toHabitMeta, validateBuilder, withFieldKeys,
  type BuilderField, type BuilderGoal, type BuilderState,
} from './builder-model'
import { FieldEditor, SwitchRow } from './field-editor'
import { HabitEntryForm } from './habit-entry-form'
import { frequencySummary } from './habit-format'
import { ColorPicker, IconPicker, WeekdayPicker } from './habit-pickers'
import { PrivacyBadge } from './privacy-badge'

export type HabitBuilderResult = { meta: HabitDraftMeta; fields: FieldDraft[]; goal: GoalDraft }

type Props = {
  mode: 'create' | 'edit'
  initial: BuilderState
  templateKey?: string | null
  /** Persists the habit; the caller handles errors (toast) and navigation on success. */
  onSave: (result: HabitBuilderResult) => Promise<void>
}

const NO_GOAL = '__none__'

/** Two-step habit builder: edit details & fields, then preview the real entry form and save. */
export function HabitBuilder({ mode, initial, templateKey, onSave }: Props) {
  const online = useOnline()
  const [state, setState] = useState<BuilderState>(initial)
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [showErrors, setShowErrors] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const errors = useMemo(() => validateBuilder(state), [state])
  const visibleErrors = showErrors ? errors : {}
  const hasErrors = Object.keys(errors).length > 0

  const patch = (p: Partial<BuilderState>) => setState((s) => ({ ...s, ...p }))

  const setFields = (update: (fields: BuilderField[]) => BuilderField[]) =>
    setState((s) => {
      const fields = withFieldKeys(update(s.fields))
      const next = { ...s, fields }
      return { ...next, goal: reconcileGoal(next) }
    })

  const updateField = (uid: string, p: Partial<BuilderField>) => setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...p } : f)))
  const changeType = (uid: string, type: FieldType) =>
    setState((s) => {
      const fields = s.fields.map((f) => (f.uid === uid ? changeFieldType(f, type) : f))
      // A goal on this field must be set up again for the new type.
      const goal: BuilderGoal =
        s.goal.fieldUid === uid
          ? { fieldUid: type === 'text' ? null : uid, operator: isChoiceType(type) ? 'eq' : 'gte', value: '' }
          : s.goal
      const next = { ...s, fields, goal }
      return { ...next, goal: reconcileGoal(next) }
    })
  const removeField = (uid: string) => setFields((fs) => fs.filter((f) => f.uid !== uid))
  const moveField = (uid: string, dir: -1 | 1) =>
    setFields((fs) => {
      const i = fs.findIndex((f) => f.uid === uid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= fs.length) return fs
      const next = [...fs]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  const addField = () => {
    const field = emptyField()
    flushSync(() => setFields((fs) => [...fs, field]))
    document.getElementById(`field-${field.uid}-label`)?.focus()
  }

  function goToPreview() {
    if (hasErrors) {
      setShowErrors(true)
      toast.error('A few things need your attention before the preview.')
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[data-habit-builder] [aria-invalid="true"]')
        el?.focus()
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    setStep('preview')
    topRef.current?.scrollIntoView({ block: 'start' })
  }

  function backToEdit() {
    setStep('edit')
    topRef.current?.scrollIntoView({ block: 'start' })
  }

  async function save() {
    setSaving(true)
    try {
      await onSave({ meta: toHabitMeta(state), fields: toFieldDrafts(state), goal: toGoalDraft(state) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={topRef} data-habit-builder className="scroll-mt-4 space-y-4">
      <StepIndicator step={step} />
      {step === 'edit' ? (
        <EditStep
          mode={mode}
          state={state}
          errors={visibleErrors}
          patch={patch}
          updateField={updateField}
          changeType={changeType}
          removeField={removeField}
          moveField={moveField}
          addField={addField}
          setGoal={(goal) => setState((s) => ({ ...s, goal }))}
        />
      ) : (
        <PreviewStep mode={mode} state={state} templateKey={templateKey} />
      )}

      {!online ? (
        <p role="status" className="rounded-xl bg-lemon/60 px-3 py-2 text-sm">
          You're offline. You can keep editing, and save once you reconnect.
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        {step === 'edit' ? (
          <Button type="button" className="h-12 flex-1 text-base" onClick={goToPreview}>
            <Eye className="size-5" /> Preview
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" className="h-12 flex-1 text-base" onClick={backToEdit} disabled={saving}>
              <ArrowLeft className="size-5" /> Back to edit
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              destructive={false}
              title={mode === 'create' ? 'Save this habit?' : 'Save your changes?'}
              description={
                <>
                  {state.visibility === 'family'
                    ? 'It will be shared with your family, including its entries and notes.'
                    : 'It will stay private — only you can see it.'}
                  {mode === 'edit' ? ' Past entries keep the fields they were recorded with.' : ''}
                </>
              }
              confirmLabel="Save habit"
              onConfirm={save}
              trigger={
                <Button type="button" className="h-12 flex-1 text-base" disabled={!online || saving}>
                  <Save className="size-5" /> {saving ? 'Saving…' : 'Save habit'}
                </Button>
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: 'edit' | 'preview' }) {
  return (
    <ol className="flex items-center gap-2 text-sm font-semibold" aria-label="Steps">
      {(['edit', 'preview'] as const).map((s, i) => (
        <li key={s} aria-current={step === s ? 'step' : undefined} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="h-px w-6 bg-border" /> : null}
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs',
              step === s ? 'bg-primary text-primary-foreground' : 'bg-lavender/60 text-foreground',
            )}
          >
            {i + 1}
          </span>
          <span className={step === s ? '' : 'text-muted-foreground'}>{s === 'edit' ? 'Build' : 'Preview'}</span>
        </li>
      ))}
    </ol>
  )
}

function Section({ title, description, children, id }: { title: string; description?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <GlassCard as="section" aria-labelledby={id} className="space-y-4">
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </GlassCard>
  )
}

type EditStepProps = {
  mode: 'create' | 'edit'
  state: BuilderState
  errors: Record<string, string>
  patch: (p: Partial<BuilderState>) => void
  updateField: (uid: string, p: Partial<BuilderField>) => void
  changeType: (uid: string, type: FieldType) => void
  removeField: (uid: string) => void
  moveField: (uid: string, dir: -1 | 1) => void
  addField: () => void
  setGoal: (goal: BuilderGoal) => void
}

function EditStep({ mode, state, errors, patch, updateField, changeType, removeField, moveField, addField, setGoal }: EditStepProps) {
  const shared = state.visibility === 'family'
  return (
    <>
      <Section title="Basics" id="builder-basics">
        <div className="space-y-2">
          <Label htmlFor="habit-name">Name</Label>
          <Input
            id="habit-name"
            className="h-12 text-base"
            placeholder="e.g. Reading"
            maxLength={NAME_MAX}
            value={state.name}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'habit-name-error' : undefined}
            onChange={(e) => patch({ name: e.target.value })}
          />
          {errors.name ? (
            <p id="habit-name-error" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="habit-description"
            rows={2}
            className="text-base"
            placeholder="Why does this habit matter to you?"
            maxLength={DESCRIPTION_MAX}
            value={state.description}
            aria-invalid={!!errors.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
          {errors.description ? <p className="text-sm text-destructive">{errors.description}</p> : null}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Icon</p>
          <IconPicker value={state.icon} color={state.color} onChange={(icon) => patch({ icon })} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Colour</p>
          <ColorPicker value={state.color} onChange={(color) => patch({ color })} />
        </div>
      </Section>

      <Section title="When" description="Pick the days you plan to do this habit." id="builder-frequency">
        <WeekdayPicker
          value={state.frequencyDays}
          onChange={(frequencyDays) => patch({ frequencyDays })}
          invalid={!!errors.frequency}
          describedBy={errors.frequency ? 'frequency-error' : undefined}
        />
        {errors.frequency ? (
          <p id="frequency-error" className="text-sm text-destructive">
            {errors.frequency}
          </p>
        ) : null}
      </Section>

      <Section title="Privacy" id="builder-privacy">
        <SwitchRow
          id="habit-share"
          label="Share with family"
          checked={shared}
          onCheckedChange={(on) => patch({ visibility: on ? 'family' : 'private' })}
        />
        <div className={cn('flex gap-3 rounded-xl p-3 text-sm', shared ? 'bg-mint/40' : 'bg-lavender/40')}>
          {shared ? <Users className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <p>
            {shared
              ? 'Your family can see this habit, every entry you record (values and notes) and your progress. It can count toward family challenges and the leaderboard.'
              : 'Only you can see this habit, its entries and notes. It never appears in family views, challenges or the leaderboard.'}
          </p>
        </div>
      </Section>

      <Section title="Additional notes" description="Add a free-text notes box to every entry." id="builder-notes">
        <RadioGroup
          value={state.notesEnabled ? 'yes' : 'no'}
          onValueChange={(v) => patch({ notesEnabled: v === 'yes' })}
          aria-label="Enable additional notes"
          className="grid-cols-2"
        >
          {(['yes', 'no'] as const).map((v) => (
            <Label
              key={v}
              htmlFor={`notes-${v}`}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-glass px-4 text-base has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-lavender/50"
            >
              <RadioGroupItem id={`notes-${v}`} value={v} className="size-5" />
              {v === 'yes' ? 'Yes' : 'No'}
            </Label>
          ))}
        </RadioGroup>
      </Section>

      <Section
        title="Fields"
        id="builder-fields"
        description={
          <>
            What you record each time — up to {MAX_FIELDS} fields.
            {mode === 'edit' ? (
              <span className="mt-2 flex items-start gap-2 rounded-xl bg-sky/40 p-2 text-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Past entries keep the fields they were recorded with.
              </span>
            ) : null}
          </>
        }
      >
        <ol className="space-y-3">
          {state.fields.map((field, i) => (
            <FieldEditor
              key={field.uid}
              field={field}
              index={i}
              count={state.fields.length}
              errors={errors}
              onChange={(p) => updateField(field.uid, p)}
              onTypeChange={(t) => changeType(field.uid, t)}
              onRemove={() => removeField(field.uid)}
              onMove={(d) => moveField(field.uid, d)}
            />
          ))}
        </ol>
        {errors.fields ? <p className="text-sm text-destructive">{errors.fields}</p> : null}
        <Button type="button" variant="secondary" className="h-12 w-full" onClick={addField} disabled={state.fields.length >= MAX_FIELDS}>
          <Plus className="size-5" /> Add field
        </Button>
        {state.fields.length >= MAX_FIELDS ? (
          <p className="text-center text-xs text-muted-foreground">That's the maximum of {MAX_FIELDS} fields.</p>
        ) : null}
      </Section>

      <GoalEditor state={state} errors={errors} setGoal={setGoal} />
    </>
  )
}

function GoalEditor({ state, errors, setGoal }: { state: BuilderState; errors: Record<string, string>; setGoal: (g: BuilderGoal) => void }) {
  const { goal } = state
  const eligible = state.fields.filter((f) => f.field_type !== 'text')
  const field = state.fields.find((f) => f.uid === goal.fieldUid)
  const fieldName = (f: BuilderField) => f.label.trim() || `Field ${state.fields.indexOf(f) + 1}`

  function pickField(uid: string) {
    if (uid === NO_GOAL) return setGoal({ fieldUid: null, operator: 'gte', value: '' })
    const f = state.fields.find((x) => x.uid === uid)
    if (!f) return
    const previous = state.fields.find((x) => x.uid === goal.fieldUid)
    const operator: GoalOperator = isChoiceType(f.field_type) ? 'eq' : previous?.field_type === 'number' ? goal.operator : 'gte'
    setGoal({ fieldUid: uid, operator, value: '' })
  }

  return (
    <Section
      title="Goal (optional)"
      id="builder-goal"
      description="Decide what counts as done. Without a goal, an entry is complete once its required fields are filled."
    >
      <div className="space-y-2">
        <Label htmlFor="goal-field">Goal field</Label>
        <Select value={goal.fieldUid ?? NO_GOAL} onValueChange={pickField}>
          <SelectTrigger
            id="goal-field"
            className="h-12 w-full text-base data-[size=default]:h-12"
            aria-invalid={!!errors['goal.field']}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GOAL} className="min-h-11">
              No goal
            </SelectItem>
            {eligible.map((f) => (
              <SelectItem key={f.uid} value={f.uid} className="min-h-11">
                {fieldName(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors['goal.field'] ? <p className="text-sm text-destructive">{errors['goal.field']}</p> : null}
        {state.fields.some((f) => f.field_type === 'text') ? (
          <p className="text-xs text-muted-foreground">Text fields can't be used as a goal.</p>
        ) : null}
      </div>

      {field && field.field_type === 'number' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="goal-operator">Should be</Label>
            <Select value={goal.operator} onValueChange={(v) => setGoal({ ...goal, operator: v as GoalOperator })}>
              <SelectTrigger id="goal-operator" className="h-12 w-full text-base data-[size=default]:h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['gte', 'lte', 'eq'] as const).map((op) => (
                  <SelectItem key={op} value={op} className="min-h-11">
                    {GOAL_OPERATOR_LABELS[op]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-value">Value</Label>
            <div className="relative">
              <Input
                id="goal-value"
                className={cn('h-12 text-base', field.unit.trim() && 'pr-14')}
                inputMode="decimal"
                value={goal.value}
                aria-invalid={!!errors['goal.value']}
                aria-describedby={errors['goal.value'] ? 'goal-value-error' : undefined}
                onChange={(e) => setGoal({ ...goal, value: e.target.value })}
              />
              {field.unit.trim() ? (
                <span className="pointer-events-none absolute top-1/2 right-3 max-w-12 -translate-y-1/2 truncate text-sm text-muted-foreground">
                  {field.unit.trim()}
                </span>
              ) : null}
            </div>
          </div>
          {errors['goal.value'] ? (
            <p id="goal-value-error" className="col-span-2 text-sm text-destructive">
              {errors['goal.value']}
            </p>
          ) : null}
        </div>
      ) : null}

      {field && isChoiceType(field.field_type) ? (
        <div className="space-y-2">
          <Label htmlFor="goal-option">Done when the answer is</Label>
          {cleanOptions(field.options).length ? (
            <Select value={goal.value || undefined} onValueChange={(v) => setGoal({ ...goal, operator: 'eq', value: v })}>
              <SelectTrigger
                id="goal-option"
                className="h-12 w-full text-base data-[size=default]:h-12"
                aria-invalid={!!errors['goal.value']}
              >
                <SelectValue placeholder="Choose an option" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set(cleanOptions(field.options))].map((o) => (
                  <SelectItem key={o} value={o} className="min-h-11">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Add options to this field first.</p>
          )}
          {errors['goal.value'] ? <p className="text-sm text-destructive">{errors['goal.value']}</p> : null}
        </div>
      ) : null}
    </Section>
  )
}

function PreviewStep({ mode, state, templateKey }: { mode: 'create' | 'edit'; state: BuilderState; templateKey?: string | null }) {
  const drafts = useMemo(() => toFieldDrafts(state), [state])
  const goalLike = useMemo(() => goalLikeFromDraft(toGoalDraft(state)), [state])
  const meta = toHabitMeta(state)
  const goalText = describeGoal(goalLike, drafts)

  function tryIt(values: FieldValues) {
    const complete = isEntryComplete(goalLike, drafts, values)
    toast.success(
      complete
        ? 'Preview only — this entry would count as complete. Nothing was saved.'
        : "Preview only — this entry would be saved, goal not reached yet. Nothing was saved.",
    )
  }

  return (
    <>
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-3">
          <HabitIcon icon={meta.icon} color={meta.color} className="size-12" iconClassName="size-6" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{meta.name}</h2>
            <p className="text-sm text-muted-foreground">{frequencySummary(meta.frequency_days)}</p>
          </div>
        </div>
        {meta.description ? <p className="text-sm">{meta.description}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <PrivacyBadge visibility={meta.visibility} />
          <span className="inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
            Notes {meta.notes_enabled ? 'on' : 'off'}
          </span>
        </div>
        <p className="text-sm">
          <span className="font-semibold">Goal: </span>
          {goalText ?? 'Complete when all required fields are filled'}
        </p>
        {mode === 'edit' ? <p className="text-xs text-muted-foreground">Past entries keep the fields they were recorded with.</p> : null}
      </GlassCard>

      <GlassCard as="section" aria-labelledby="preview-title" className="space-y-4">
        <div>
          <h2 id="preview-title" className="text-lg font-bold">
            Try the entry form
          </h2>
          <p className="text-sm text-muted-foreground">This is exactly what you'll fill in. Nothing here is saved.</p>
        </div>
        <HabitEntryForm
          fields={drafts}
          notesEnabled={meta.notes_enabled}
          templateKey={templateKey}
          goal={goalLike}
          submitLabel="Check my answers"
          onSubmit={tryIt}
        />
      </GlassCard>
    </>
  )
}
