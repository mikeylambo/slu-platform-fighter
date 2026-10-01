/**
 * Hardware bench (`?bench`): a fixed CPU-vs-CPU match on the heaviest stage, timed per
 * rendered frame. Reports mean / p95 / worst frame time, simulation step time, draw calls,
 * and the GPU renderer string, with a one-click copy. Pass criteria: GDD section 14.
 */
import type { WebGLRenderer } from 'three';
import type { DuelOptions } from '../game/duel.js';

export const BENCH = {
  /** Simulated seconds (60 sim frames each). Override with `?bench&seconds=N`. */
  seconds: 60,
  /** Widest camera framing and two moving platforms: the most expensive stage to draw. */
  stage: 'skyreach',
  seed: 0xbe9c4,
  /** GDD 14 targets. */
  targets: { frameMs: 1000 / 60, p95Ms: 1000 / 60, simMs: 2 },
} as const;

export interface BenchResult {
  frames: number;
  simulatedFrames: number;
  meanMs: number;
  p95Ms: number;
  worstMs: number;
  fps: number;
  simMeanMs: number;
  simWorstMs: number;
  renderMeanMs: number;
  drawCalls: number;
  triangles: number;
  gpu: string;
  userAgent: string;
  pass: { frame: boolean; p95: boolean; sim: boolean };
}

export function benchOptions(base: DuelOptions): DuelOptions {
  return {
    ...base,
    stage: BENCH.stage,
    format: 'continuous',
    lives: 8,
    timer: 0,
    cpu: [9, 9],
    oaths: ['iron', 'hunger'],
  };
}

export function benchSeconds(): number | null {
  const params = new URLSearchParams(location.search);
  if (!params.has('bench')) return null;
  const seconds = Number(params.get('seconds'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : BENCH.seconds;
}

/** The unmasked GPU string when the browser exposes it. */
export function gpuName(renderer: WebGLRenderer): string {
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return String(name);
}

const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
};
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

export class BenchRecorder {
  private frameMs: number[] = [];
  private simMs: number[] = [];
  private renderMs: number[] = [];
  private drawCalls = 0;
  private triangles = 0;
  simulated = 0;
  /** Skip the first frames (shader compilation, asset loads). */
  private warmup = 30;

  constructor(readonly targetFrames: number) {}

  get done(): boolean {
    return this.simulated >= this.targetFrames;
  }

  sample(frameMs: number, simMs: number[], renderMs: number, drawCalls: number, triangles: number): void {
    this.simulated += simMs.length;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.frameMs.push(frameMs);
    this.simMs.push(...simMs);
    this.renderMs.push(renderMs);
    this.drawCalls = Math.max(this.drawCalls, drawCalls);
    this.triangles = Math.max(this.triangles, triangles);
  }

  result(gpu: string): BenchResult {
    const meanMs = mean(this.frameMs);
    const p95Ms = percentile(this.frameMs, 0.95);
    const simMeanMs = mean(this.simMs);
    return {
      frames: this.frameMs.length,
      simulatedFrames: this.simulated,
      meanMs,
      p95Ms,
      worstMs: Math.max(0, ...this.frameMs),
      fps: 1000 / Math.max(0.001, meanMs),
      simMeanMs,
      simWorstMs: Math.max(0, ...this.simMs),
      renderMeanMs: mean(this.renderMs),
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      gpu,
      userAgent: navigator.userAgent,
      pass: {
        // A small tolerance for rAF jitter around the 16.7 ms vsync interval.
        frame: meanMs <= BENCH.targets.frameMs + 0.5,
        p95: p95Ms <= BENCH.targets.p95Ms + 1.5,
        sim: simMeanMs <= BENCH.targets.simMs,
      },
    };
  }
}

/** Formats the result as a plain-text block for pasting into an issue or chat. */
export function benchReport(result: BenchResult): string {
  const mark = (ok: boolean) => (ok ? 'PASS' : 'FAIL');
  return [
    'SPECTRIS BENCH',
    `GPU: ${result.gpu}`,
    `Browser: ${result.userAgent}`,
    `Frames: ${result.frames} rendered / ${result.simulatedFrames} simulated`,
    `Frame time: mean ${result.meanMs.toFixed(2)} ms (${result.fps.toFixed(1)} fps) ${mark(result.pass.frame)}`,
    `Frame time: p95 ${result.p95Ms.toFixed(2)} ms ${mark(result.pass.p95)} · worst ${result.worstMs.toFixed(2)} ms`,
    `Sim step: mean ${result.simMeanMs.toFixed(3)} ms ${mark(result.pass.sim)} · worst ${result.simWorstMs.toFixed(3)} ms`,
    `Render (CPU submit): mean ${result.renderMeanMs.toFixed(2)} ms`,
    `Draw calls: ${result.drawCalls} · triangles: ${result.triangles}`,
  ].join('\n');
}
