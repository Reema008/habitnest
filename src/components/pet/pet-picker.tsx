import { useState } from 'react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PET_NAMES, PET_TYPES, type PetType } from '@/types/models'
import { PET_BLURBS } from './pet-config'
import { Pet } from './pet'

function isPetType(value: string): value is PetType {
  return (PET_TYPES as string[]).includes(value)
}

/** Five large selectable companion cards (radio-group semantics, arrow-key navigation). */
export function PetPicker({ value, onChange }: { value: PetType | null; onChange: (pet: PetType) => void }) {
  const [hello, setHello] = useState(0)

  return (
    <RadioGroupPrimitive.Root
      aria-label="Choose your pet"
      value={value ?? ''}
      onValueChange={(next) => {
        if (!isPetType(next)) return
        setHello((n) => n + 1)
        onChange(next)
      }}
      className="grid grid-cols-2 gap-3"
    >
      {PET_TYPES.map((pet) => {
        const selected = value === pet
        return (
          <RadioGroupPrimitive.Item
            key={pet}
            value={pet}
            className={cn(
              'relative flex min-h-44 flex-col items-center justify-center gap-1 rounded-3xl border-2 p-3 text-center transition-colors last:col-span-2',
              'outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60',
              selected ? 'border-primary bg-lavender/50' : 'border-glass-border bg-glass hover:bg-lavender/30',
            )}
          >
            {selected ? (
              <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" aria-hidden />
              </span>
            ) : null}
            <Pet type={pet} size={104} label="" gesture={selected ? 'bounce' : null} gestureKey={hello} />
            <span className="text-sm font-bold leading-tight">{PET_NAMES[pet]}</span>
            <span className="text-xs text-muted-foreground">{PET_BLURBS[pet]}</span>
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
}
