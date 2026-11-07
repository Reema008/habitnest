import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDay, friendlyDay, parseDate, shiftDate, toISODate } from '@/lib/dates'

/** Previous / next day, a calendar popover and a "Today" shortcut. Future days are disabled. */
export function DateNavigator({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const isToday = date === today
  const todayDate = parseDate(today)

  return (
    <nav aria-label="Choose a day" className="space-y-2">
      <div className="glass flex items-center gap-1 rounded-2xl p-1">
        <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label="Previous day" onClick={() => onChange(shiftDate(date, -1))}>
          <ChevronLeft className="size-6" />
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 min-w-0 flex-1 rounded-xl text-base font-bold"
              aria-label={`Pick a date. Showing ${formatDay(date, 'EEEE d MMMM yyyy')}`}
            >
              <CalendarDays className="size-5" aria-hidden />
              <span className="truncate">{friendlyDay(date)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="center">
            <Calendar
              mode="single"
              selected={parseDate(date)}
              defaultMonth={parseDate(date)}
              endMonth={todayDate}
              disabled={{ after: todayDate }}
              style={{ '--cell-size': '2.75rem' } as React.CSSProperties}
              onSelect={(d) => {
                if (!d) return
                onChange(toISODate(d))
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => onChange(shiftDate(date, 1))}
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>
      {!isToday ? (
        <div className="flex justify-center">
          <Button variant="secondary" className="h-11 rounded-full px-5" onClick={() => onChange(today)}>
            Today
          </Button>
        </div>
      ) : null}
    </nav>
  )
}
