export type RootMotionPolicy = 'disabled' | 'authored-sim-only';
export interface PresentationPolicy {
  rootMotion: RootMotionPolicy;
  hitstopCameraFreeze: boolean;
  launchZoomEmphasis: boolean;
  screenShakeScalePermille: number;
  heldItemSocketRole: string;
}
export interface PresentationEmphasisCue {
  freezeCameraFrames: number;
  zoomPermille: number;
  shakePermille: number;
}
export function validatePresentationPolicy(policy: PresentationPolicy): void {
  if (!policy.heldItemSocketRole) throw new Error('heldItemSocketRole required');
  if (!Number.isInteger(policy.screenShakeScalePermille) || policy.screenShakeScalePermille < 0 || policy.screenShakeScalePermille > 1000) throw new Error('screenShakeScalePermille must be integer 0–1000');
}
export function emphasisForHit(hitlagFrames: number, knockbackMagnitude: number, policy: PresentationPolicy): PresentationEmphasisCue {
  validatePresentationPolicy(policy);
  if (!Number.isInteger(hitlagFrames) || hitlagFrames < 0 || !Number.isInteger(knockbackMagnitude) || knockbackMagnitude < 0) throw new Error('hit emphasis inputs must be nonnegative integers');
  const launchBoost = policy.launchZoomEmphasis ? Math.min(250, Math.trunc(knockbackMagnitude / 20000)) : 0;
  return {
    freezeCameraFrames: policy.hitstopCameraFreeze ? hitlagFrames : 0,
    zoomPermille: 1000 + launchBoost,
    shakePermille: Math.min(policy.screenShakeScalePermille, Math.trunc(knockbackMagnitude / 10000)),
  };
}
export function assertNoPresentationRootMotion(policy: PresentationPolicy, animationRootDelta: { x: number; y: number; z: number }): void {
  if (policy.rootMotion === 'disabled' && (animationRootDelta.x !== 0 || animationRootDelta.y !== 0 || animationRootDelta.z !== 0)) throw new Error('presentation root motion is disabled; movement must come from authoritative sim/timeline data');
}
