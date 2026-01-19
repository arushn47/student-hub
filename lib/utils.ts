import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toDate(input: string | Date) {
  if (input instanceof Date) return input

  // Treat date-only strings as local dates (avoid timezone shifts).
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(input)
}

export function formatDateMDY(input: string | Date) {
  const date = toDate(input)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

export function formatDateISO(input: string | Date) {
  const date = toDate(input)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
