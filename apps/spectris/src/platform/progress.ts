import type { Oath } from '../content/rules/duel.js';
export interface Progress {
  vigil: boolean;
  unlocked: Oath[];
  clears: string[];
}
export interface Settings {
  music: number;
  sfx: number;
  voice: number;
  shake: boolean;
  contrast: boolean;
  deadzone: number;
  tapJump: boolean;
  delay: number;
  buffer: number;
  bindings: Record<string, string>;
}
export const SETTINGS: Settings = {
  music: 0.25,
  sfx: 0.6,
  voice: 0.8,
  shake: true,
  contrast: false,
  deadzone: 0.16,
  tapJump: false,
  delay: 2,
  buffer: 5,
  bindings: { jump: 'Space', attack: 'KeyJ', special: 'KeyK', grab: 'KeyU', dodge: 'KeyL', stance: 'KeyI' },
};
export function readProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem('spectris-progress') ?? 'null') as Progress | null;
    if (p && Array.isArray(p.unlocked) && Array.isArray(p.clears)) return p;
  } catch {
    /* New profile on invalid storage. */
  }
  return { vigil: false, unlocked: ['unsworn'], clears: [] };
}
export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('spectris-settings') ?? '{}') as Partial<Settings>;
    return { ...SETTINGS, ...saved, bindings: { ...SETTINGS.bindings, ...saved.bindings } };
  } catch {
    return { ...SETTINGS };
  }
}
export function persist(key: 'progress' | 'settings', value: Progress | Settings) {
  try {
    localStorage.setItem(`spectris-${key}`, JSON.stringify(value));
  } catch {
    /* Gameplay works with storage disabled. */
  }
}
