// ---------------------------------------------------------------------------
// Plan definitions and limits.
// Only the free tier exists for now — add paid tiers when payments are enabled.
// ---------------------------------------------------------------------------

export const PLANS = {
    free: {
        name: 'Free',
        limits: {
            ai_messages_per_day: 50,
            exam_prep_subjects: 5,
            notes: 100,
            storage_mb: 200,
        },
    },
} as const

export type Plan = keyof typeof PLANS

/**
 * Get limits for a given plan. Falls back to free if the plan is unknown.
 */
export function getPlanLimits(plan: string) {
    const key = plan as Plan
    return (PLANS[key] ?? PLANS.free).limits
}
