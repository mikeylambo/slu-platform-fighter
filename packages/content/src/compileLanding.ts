export interface FrameWindow {
  startFrame: number;
  endFrame: number;
}

export interface AerialLandingDefinition {
  attackId: string;
  landingLagFrames: number;
  autoCancelWindows: readonly FrameWindow[];
}

interface PackMove {
  totalFrames: number;
  landing?: { landingLagFrames: number; autoCancelWindows: readonly FrameWindow[] };
}
interface FighterPackLike { id: string; moves: Readonly<Record<string, PackMove>>; }

export function compileAerialLanding(fighterId: string, moveName: string, move: PackMove): AerialLandingDefinition | null {
  if (!move.landing) return null;
  const { landingLagFrames, autoCancelWindows } = move.landing;
  if (!Number.isInteger(landingLagFrames) || landingLagFrames < 0) throw new Error(`${fighterId}:${moveName} landing lag must be nonnegative integer`);
  const windows = [...autoCancelWindows].map((window) => ({ ...window })).sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
  let previousEnd = -1;
  for (const window of windows) {
    if (!Number.isInteger(window.startFrame) || !Number.isInteger(window.endFrame) || window.startFrame < 0 || window.endFrame < window.startFrame || window.endFrame >= move.totalFrames) {
      throw new Error(`${fighterId}:${moveName} invalid autocancel window ${window.startFrame}-${window.endFrame}`);
    }
    if (window.startFrame <= previousEnd) throw new Error(`${fighterId}:${moveName} autocancel windows overlap`);
    previousEnd = window.endFrame;
  }
  return { attackId: `${fighterId}:${moveName}`, landingLagFrames, autoCancelWindows: windows };
}

export function compileFighterLandingPolicies(pack: FighterPackLike): Map<string, AerialLandingDefinition> {
  const result = new Map<string, AerialLandingDefinition>();
  for (const [moveName, move] of Object.entries(pack.moves).sort(([a], [b]) => a.localeCompare(b))) {
    const compiled = compileAerialLanding(pack.id, moveName, move);
    if (compiled) result.set(compiled.attackId, compiled);
  }
  return result;
}

export function isAutoCancelFrame(definition: AerialLandingDefinition, attackFrame: number): boolean {
  return definition.autoCancelWindows.some((window) => attackFrame >= window.startFrame && attackFrame <= window.endFrame);
}
