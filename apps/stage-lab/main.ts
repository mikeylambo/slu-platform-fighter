import greybox from '../../stages/greybox/stage.json' with { type: 'json' };

type Point = { x: number; y: number };
type Surface = { id: string; kind: 'solid' | 'one-way'; y: number; xMin: number; xMax: number };
type Ledge = { id: string; x: number; y: number; inward: -1 | 1 };
type Spawn = { id: string; x: number; y: number; facing: -1 | 1 };
type MovingPlatform = { id: string; kind: 'solid' | 'one-way'; width: number; path: Point[]; periodFrames: number; phaseFrames: number };
type Hazard = { id: string; kind: 'damage' | 'launch' | 'ko'; x: number; y: number; radius: number; activeFrames: number; inactiveFrames: number; phaseFrames: number };
type StagePack = { id: string; identity: { displayName: string }; surfaces: Surface[]; ledges: Ledge[]; spawns: Spawn[]; blastZone: { left: number; right: number; bottom: number; top: number }; camera: { bounds: { left: number; right: number; bottom: number; top: number }; padding: number; minZoom: number; maxZoom: number }; movingPlatforms: MovingPlatform[]; hazards: Hazard[]; [key: string]: unknown };

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const ctx = canvas.getContext('2d')!;
const textarea = document.querySelector<HTMLTextAreaElement>('#json')!;
const status = document.querySelector<HTMLDivElement>('#status')!;
const frameInput = document.querySelector<HTMLInputElement>('#frame')!;
const frameLabel = document.querySelector<HTMLDivElement>('#frameLabel')!;
textarea.value = JSON.stringify(greybox, null, 2);
let pack = structuredClone(greybox) as unknown as StagePack;
let frame = 0;

function validate(p: unknown): asserts p is StagePack {
  const q = p as Partial<StagePack>;
  if (!q.id || !Array.isArray(q.surfaces) || !q.blastZone || !q.camera || !Array.isArray(q.spawns)) throw new Error('stage requires id, surfaces, spawns, blastZone and camera');
  if (q.spawns.length < 2) throw new Error('stage requires at least two spawn points');
  for (const surface of q.surfaces) {
    if (!Number.isInteger(surface.xMin) || !Number.isInteger(surface.xMax) || !Number.isInteger(surface.y) || surface.xMin >= surface.xMax) throw new Error(`invalid surface ${surface.id}`);
  }
}

function movingPoint(platform: MovingPlatform, targetFrame: number): Point {
  const path = platform.path;
  if (path.length === 0) throw new Error(`${platform.id} requires at least one path point`);
  if (path.length === 1) return path[0]!;
  const period: number = Math.max(2, Math.trunc(Number(platform.periodFrames)));
  const half: number = Math.max(1, Math.trunc(period / 2));
  const phase: number = Math.trunc(Number(platform.phaseFrames));
  const local: number = ((targetFrame + phase) % period + period) % period;
  const progress: number = (local <= half ? local : period - local) / half;
  const segmentCount: number = path.length - 1;
  const scaled: number = Math.min(segmentCount - 0.000000001, progress * segmentCount);
  const index: number = Math.floor(scaled);
  const blend: number = scaled - index;
  const a = path[index]!;
  const b = path[Math.min(index + 1, path.length - 1)]!;
  return { x: Math.round(a.x + (b.x - a.x) * blend), y: Math.round(a.y + (b.y - a.y) * blend) };
}

function bounds(p: StagePack) { const b = p.camera.bounds; return { left: b.left, right: b.right, bottom: b.bottom, top: b.top }; }
function sx(x: number, b: { left: number; right: number }) { return (x - b.left) / (b.right - b.left) * canvas.width; }
function sy(y: number, b: { bottom: number; top: number }) { return canvas.height - (y - b.bottom) / (b.top - b.bottom) * canvas.height; }

function draw() {
  const b = bounds(pack);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#d8e6ff';
  for (const surface of pack.surfaces) { ctx.beginPath(); ctx.moveTo(sx(surface.xMin, b), sy(surface.y, b)); ctx.lineTo(sx(surface.xMax, b), sy(surface.y, b)); ctx.stroke(); }
  ctx.fillStyle = '#9fd3ff';
  for (const ledge of pack.ledges) { ctx.beginPath(); ctx.arc(sx(ledge.x, b), sy(ledge.y, b), 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff0a6';
  for (const spawn of pack.spawns) { ctx.beginPath(); ctx.arc(sx(spawn.x, b), sy(spawn.y, b), 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#83ffbd';
  for (const moving of pack.movingPlatforms) { const point = movingPoint(moving, frame); const halfWidth = Number(moving.width) / 2; ctx.beginPath(); ctx.moveTo(sx(point.x - halfWidth, b), sy(point.y, b)); ctx.lineTo(sx(point.x + halfWidth, b), sy(point.y, b)); ctx.stroke(); }
  for (const hazard of pack.hazards) { const cycle = Number(hazard.activeFrames) + Number(hazard.inactiveFrames); const active = cycle > 0 && ((frame + Number(hazard.phaseFrames)) % cycle + cycle) % cycle < Number(hazard.activeFrames); ctx.strokeStyle = active ? '#ff9e9e' : '#704848'; ctx.beginPath(); const radiusPixels = Math.abs(sx(hazard.x + hazard.radius, b) - sx(hazard.x, b)); ctx.arc(sx(hazard.x, b), sy(hazard.y, b), radiusPixels, 0, Math.PI * 2); ctx.stroke(); }
  frameLabel.textContent = `Frame ${frame}`;
}

function apply() {
  try { const parsed: unknown = JSON.parse(textarea.value); validate(parsed); pack = parsed; status.textContent = `PASS — ${pack.id}: ${pack.surfaces.length} surfaces, ${pack.ledges.length} ledges, ${pack.spawns.length} spawns, ${pack.movingPlatforms.length} moving platforms, ${pack.hazards.length} hazards.`; draw(); }
  catch (error) { status.textContent = `FAIL — ${error instanceof Error ? error.message : String(error)}`; }
}

document.querySelector('#apply')!.addEventListener('click', apply);
document.querySelector('#copy')!.addEventListener('click', () => navigator.clipboard.writeText(textarea.value));
frameInput.addEventListener('input', () => { frame = Number(frameInput.value); draw(); });
apply();
