export const PROFILE_FORMAT_VERSION = 1;

export interface AccessibilitySettings {
  screenShakeScalePermille: number;
  hitFlashScalePermille: number;
  cameraMotionScalePermille: number;
  highContrastHud: boolean;
  reduceRapidFlashes: boolean;
  holdToMashAssist: boolean;
}
export interface AudioSettings { masterPermille: number; musicPermille: number; sfxPermille: number; voicePermille: number; }
export interface VideoSettings { fullscreen: boolean; renderScalePermille: number; }
export interface PlayerStatistics {
  matchesPlayed: number; wins: number; kos: number; selfDestructs: number; damageDealtTenths: number; playFrames: number;
  fighterMatches: Readonly<Record<string, number>>;
}
export interface UnlockState { unlockedFighterIds: readonly string[]; unlockedStageIds: readonly string[]; unlockedRewardIds: readonly string[]; currency: number; }
export interface CustomizationState { selectedPaletteByFighter: Readonly<Record<string, string>>; equippedRewardIds: readonly string[]; }
export interface PlayerProfile {
  formatVersion: typeof PROFILE_FORMAT_VERSION;
  profileId: string;
  accessibility: AccessibilitySettings;
  audio: AudioSettings;
  video: VideoSettings;
  inputProfileIdsByController: Readonly<Record<string, string>>;
  unlocks: UnlockState;
  customization: CustomizationState;
  statistics: PlayerStatistics;
}

function permille(value: number, name: string): void { if (!Number.isInteger(value) || value < 0 || value > 1000) throw new Error(`${name} must be integer permille 0–1000`); }
export function validatePlayerProfile(profile: PlayerProfile): void {
  if (profile.formatVersion !== PROFILE_FORMAT_VERSION) throw new Error(`unsupported player profile format ${profile.formatVersion}`);
  if (!profile.profileId) throw new Error('profileId required');
  permille(profile.accessibility.screenShakeScalePermille, 'screenShakeScalePermille'); permille(profile.accessibility.hitFlashScalePermille, 'hitFlashScalePermille'); permille(profile.accessibility.cameraMotionScalePermille, 'cameraMotionScalePermille');
  for (const [name, value] of Object.entries(profile.audio)) permille(value, name);
  permille(profile.video.renderScalePermille, 'renderScalePermille');
  const s = profile.statistics;
  for (const [name, value] of Object.entries({ matchesPlayed: s.matchesPlayed, wins: s.wins, kos: s.kos, selfDestructs: s.selfDestructs, damageDealtTenths: s.damageDealtTenths, playFrames: s.playFrames })) if (!Number.isInteger(value) || value < 0) throw new Error(`statistics.${name} must be nonnegative integer`);
  if (!Number.isInteger(profile.unlocks.currency) || profile.unlocks.currency < 0) throw new Error('currency must be nonnegative integer');
}
export function migratePlayerProfile(raw: unknown): PlayerProfile {
  if (!raw || typeof raw !== 'object') throw new Error('profile payload must be object');
  const version = (raw as { formatVersion?: unknown }).formatVersion;
  if (version !== PROFILE_FORMAT_VERSION) throw new Error(`no migration path for profile format ${String(version)}`);
  const profile = structuredClone(raw) as PlayerProfile; validatePlayerProfile(profile); return profile;
}
export function createDefaultPlayerProfile(profileId = 'local'): PlayerProfile {
  return { formatVersion: 1, profileId,
    accessibility: { screenShakeScalePermille: 1000, hitFlashScalePermille: 1000, cameraMotionScalePermille: 1000, highContrastHud: false, reduceRapidFlashes: false, holdToMashAssist: false },
    audio: { masterPermille: 1000, musicPermille: 1000, sfxPermille: 1000, voicePermille: 1000 }, video: { fullscreen: false, renderScalePermille: 1000 }, inputProfileIdsByController: {},
    unlocks: { unlockedFighterIds: [], unlockedStageIds: [], unlockedRewardIds: [], currency: 0 }, customization: { selectedPaletteByFighter: {}, equippedRewardIds: [] },
    statistics: { matchesPlayed: 0, wins: 0, kos: 0, selfDestructs: 0, damageDealtTenths: 0, playFrames: 0, fighterMatches: {} } };
}
