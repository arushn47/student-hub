export type PaperExamType = 'Mid-Term' | 'End-Term'

export function normalizePaperExamType(value: string | null | undefined): PaperExamType | null {
  if (!value) return null

  const v = value.trim().toLowerCase()

  // Legacy / alternate labels that previously existed in the app
  if (v.includes('end') || v.includes('fat') || v.includes('semester')) return 'End-Term'
  if (v.includes('mid') || v.includes('cat')) return 'Mid-Term'

  // If it already matches our current canonical labels
  if (v === 'mid-term' || v === 'mid term') return 'Mid-Term'
  if (v === 'end-term' || v === 'end term') return 'End-Term'

  return null
}
