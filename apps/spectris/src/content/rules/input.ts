/**
 * Auxiliary input bits carried in `SimInputFrame.auxiliaryButtons`. They are part of
 * replay and rollback input histories, so changing them is a replay-version change.
 */
export const AUX = {
  /** Stance button pressed this frame. */
  stance: 1,
  /** Attack button held (used to hold a Feint). */
  attackHeld: 2,
  /** Special button held (charge, feint hold). */
  specialHeld: 4,
  /** Between rounds: a counterpick stage index follows in the high bits. */
  counterpick: 16,
  counterpickShift: 5,
  counterpickMask: 15,
} as const;

/** Full stick deflection in sim units. */
export const STICK_MAX = 1000;
