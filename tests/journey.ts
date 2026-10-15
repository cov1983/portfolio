// The Goal journey's model-time constants, shared by the e2e journey (exhibit-panel.spec.ts) and its
// replay under Node (tests/model/goal.test.ts). Constants only: the e2e seam imports nothing of the
// model seam's helpers.

/**
 * The e2e journey's bound on the re-entry (exhibit-panel.spec.ts): after the Goal, STAY_S with no
 * key, ArrowDown for LEAVE_S, then ArrowUp for this much model time must score again. About 1.5×
 * the replayed journey's 1.68 s, and less than half of the 6.43 s a Puck reset by R needs for the
 * same sequence (goal.test.ts proves both), so a Reset while paused fails the journey (AC-12.3,
 * 14.2).
 */
export const REENTRY_BUDGET_S = 2.5
/** How long the journey waits with no key after Escape: the Puck stays in the Goal (AC-14.2). */
export const STAY_S = 0.5
/** How long the journey holds ArrowDown to leave the Goal. */
export const LEAVE_S = 0.75
