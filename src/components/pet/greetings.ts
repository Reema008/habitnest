/**
 * Friendly time-of-day greetings from the pet. Always warm — never about missed habits,
 * streaks or anything that could feel like pressure.
 */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export function dayPart(date: Date = new Date()): DayPart {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

const GREETINGS: Record<DayPart, readonly string[]> = {
  morning: [
    'Good morning, {name}! I saved you a sunny spot.',
    'Morning, {name}! So happy to see you.',
    'Rise and shine, {name}! Let’s have a cosy day.',
    'Hi {name}! The morning feels brighter with you here.',
  ],
  afternoon: [
    'Good afternoon, {name}! How lovely to see you.',
    'Hey {name}! I was just thinking about you.',
    'Hi {name}! Hope your day is treating you kindly.',
    'Afternoon, {name}! Time for a little stretch together?',
  ],
  evening: [
    'Good evening, {name}! Welcome back to the nest.',
    'Hi {name}! I hope today had some nice moments.',
    'Evening, {name}! So glad you’re here.',
    'Hey {name}! Let’s take a calm breath together.',
  ],
  night: [
    'Hi {name}! The stars are out and so am I.',
    'Hello, night owl {name}! Nice to see you.',
    'Cosy night, {name}! I’m happy you stopped by.',
    'Hi {name}! Sending you sleepy, snuggly vibes.',
  ],
}

export function petGreeting(name: string, date: Date = new Date(), rng: () => number = Math.random): string {
  const options = GREETINGS[dayPart(date)]
  const template = options[Math.floor(rng() * options.length) % options.length]!
  return template.replace('{name}', name.trim() || 'friend')
}
