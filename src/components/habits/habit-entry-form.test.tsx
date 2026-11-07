import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FieldDraft } from '@/types/models'
import { HabitEntryForm } from './habit-entry-form'

const fields: FieldDraft[] = [
  { field_key: 'hours', label: 'Hours read', field_type: 'number', unit: 'h', options: [], required: true, validation: { min: 0, max: 24 } },
  { field_key: 'done', label: 'Status', field_type: 'radio', options: ['Completed', 'Not completed'], required: false, validation: {} },
]

beforeAll(() => {
  // jsdom lacks ResizeObserver (used by Radix radio items).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

describe('HabitEntryForm', () => {
  it('submits numbers as numbers and omits empty optional fields', async () => {
    const onSubmit = vi.fn()
    render(<HabitEntryForm fields={fields} notesEnabled templateKey="junk_food" onSubmit={onSubmit} />)
    expect(screen.getByPlaceholderText('What did you eat? (optional)')).toBeTruthy()
    await userEvent.type(screen.getByLabelText(/Hours read/), '7.5')
    await userEvent.type(screen.getByLabelText(/Additional notes/), '  Good book ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ hours: 7.5 }, 'Good book'))
  })

  it('shows field errors and a choice can be picked', async () => {
    const onSubmit = vi.fn()
    render(<HabitEntryForm fields={fields} notesEnabled={false} onSubmit={onSubmit} goal={{ goal_field_key: 'hours', goal_operator: 'gte', goal_value: 1 }} />)
    await userEvent.type(screen.getByLabelText(/Hours read/), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Must be at most 24 h')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText(/Hours read/))
    await userEvent.type(screen.getByLabelText(/Hours read/), '2')
    expect(screen.getByText(/Goal reached/)).toBeTruthy()
    await userEvent.click(screen.getByRole('radio', { name: 'Completed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ hours: 2, done: 'Completed' }, null))
  })

  it('shows server errors thrown by onSubmit', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Entries cannot be recorded for future dates'))
    render(<HabitEntryForm fields={fields} notesEnabled={false} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/Hours read/), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Entries cannot be recorded for future dates')
  })
})
