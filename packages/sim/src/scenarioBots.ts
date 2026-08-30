import type { SimInputFrame } from './types.js';

export type ScenarioBotKind = 'neutral' | 'approach-jab' | 'shield-loop' | 'grab-loop' | 'short-hop-attack' | 'recovery-mash' | 'tech-left' | 'tech-right';

function neutral(frame: number): SimInputFrame { return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false }; }
export function scenarioBotInput(kind: ScenarioBotKind, frame: number): SimInputFrame {
  const phase = frame % 30;
  if (kind === 'neutral') return neutral(frame);
  if (kind === 'approach-jab') return { ...neutral(frame), moveX: phase < 18 ? 1000 : 0, attackPressed: phase === 20 };
  if (kind === 'shield-loop') return { ...neutral(frame), shieldHeld: phase < 18 };
  if (kind === 'grab-loop') return { ...neutral(frame), moveX: phase < 12 ? 700 : 0, grabPressed: phase === 14 };
  if (kind === 'short-hop-attack') return { ...neutral(frame), jumpPressed: phase === 0, jumpHeld: phase < 2, attackPressed: phase === 6 };
  if (kind === 'recovery-mash') return { ...neutral(frame), moveY: 1000, jumpPressed: phase === 0, jumpHeld: phase < 4, specialPressed: phase === 12 };
  if (kind === 'tech-left') return { ...neutral(frame), moveX: -1000, dodgePressed: phase === 0 };
  return { ...neutral(frame), moveX: 1000, dodgePressed: phase === 0 };
}
export const SCENARIO_BOT_CATALOG: readonly ScenarioBotKind[] = ['neutral', 'approach-jab', 'shield-loop', 'grab-loop', 'short-hop-attack', 'recovery-mash', 'tech-left', 'tech-right'];
