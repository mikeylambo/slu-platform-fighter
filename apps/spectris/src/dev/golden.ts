// Golden-hash regression: 20 seeded matches whose per-checkpoint world hashes
// are recorded once and must reproduce exactly. Run with `--record` to write a
// new golden file (only when the replay version is deliberately bumped).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import type { SimInputFrame, WorldState } from '../../../../packages/sim/src/types.js';
import { createDuel, stepDuel, duelData, type DuelOptions } from '../game/duel.js';
import { neutral, IDS } from '../game/session.js';
import { STAGES } from '../content/stages/roster.js';
import { OATHS, type Oath } from '../content/rules/duel.js';
import { REPLAY_VERSION } from '../content/version.js';

const GOLDEN_PATH = 'apps/spectris/proofs/golden-hashes.json';
const MATCHES = 20;
const MAX_FRAMES = 7200;
const CHECKPOINT = 600;
const oaths = Object.keys(OATHS) as Oath[];
const coverage = new Map<string, number>();

interface GoldenMatch {
  id: number;
  label: string;
  frames: number;
  checkpoints: string[];
  final: string;
}
interface GoldenFile {
  version: string;
  matches: GoldenMatch[];
}

/** Deterministic input fuzzer: holds a random chord for a random number of frames. */
class Fuzzer {
  private state: number;
  private held: SimInputFrame = neutral(0);
  private remaining = 0;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  private next(range: number): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state % range;
  }

  private axis(): number {
    const pick = this.next(5);
    return [-1000, -500, 0, 500, 1000][pick]!;
  }

  sample(frame: number): SimInputFrame {
    if (this.remaining <= 0) {
      this.remaining = 1 + this.next(18);
      const roll = this.next(100);
      this.held = {
        ...neutral(frame),
        moveX: this.axis(),
        moveY: this.next(3) === 0 ? this.axis() : 0,
        jumpHeld: roll < 22,
        shieldHeld: roll >= 22 && roll < 34,
        smashX: this.next(12) === 0 ? this.axis() : 0,
        smashY: this.next(16) === 0 ? 1000 : 0,
        auxiliaryButtons: this.next(9) === 0 ? 1 + this.next(7) : 0,
      };
      this.held.jumpPressed = this.held.jumpHeld && this.next(2) === 0;
      this.held.attackPressed = this.next(3) === 0;
      this.held.specialPressed = this.next(5) === 0;
      this.held.grabPressed = this.next(10) === 0;
      this.held.dodgePressed = this.next(9) === 0;
      if (roll >= 90) {
        // Explicit Kindle / guard chord so meter spends and parries are exercised.
        this.held.shieldHeld = true;
        this.held.specialPressed = roll >= 95;
        this.held.attackPressed = false;
      }
    }
    this.remaining--;
    const pulse = this.remaining % 3 === 0;
    return {
      ...this.held,
      frame,
      jumpPressed: this.held.jumpPressed && pulse,
      attackPressed: !!this.held.attackPressed && pulse,
      specialPressed: !!this.held.specialPressed && pulse,
      grabPressed: !!this.held.grabPressed && pulse,
      dodgePressed: this.held.dodgePressed && pulse,
    };
  }
}

interface Scenario {
  label: string;
  options: Partial<DuelOptions>;
  fuzz: [boolean, boolean];
  meter?: number;
}

function scenario(id: number): Scenario {
  const stage = STAGES[id % STAGES.length]!.id;
  const pair: [Oath, Oath] = [oaths[id % oaths.length]!, oaths[(id * 3 + 2) % oaths.length]!];
  if (id < 8) {
    return {
      label: `cpu ${1 + id} vs cpu ${9 - id} on ${stage}`,
      options: {
        cpu: [1 + id, 9 - id],
        format: 'continuous',
        timer: 3600,
        stage,
        oaths: pair,
      },
      fuzz: [false, false],
    };
  }
  if (id < 12) {
    return {
      label: `fuzz vs cpu ${id - 3} rounds on ${stage}`,
      options: {
        cpu: [0, id - 3],
        format: 'rounds',
        bestOf: 3,
        timer: 2400,
        stage,
        oaths: pair,
        counterpick: true,
      },
      fuzz: [true, false],
    };
  }
  if (id < 14) {
    return {
      label: `fuzz vs cpu momentum`,
      options: {
        cpu: [0, 4 + id - 12],
        format: 'momentum',
        timer: 0,
        stage: 'pilgrimage',
        oaths: pair,
      },
      fuzz: [true, false],
    };
  }
  if (id < 16) {
    const lock = id === 14 ? 'cape' : 'wings';
    return {
      label: `fuzz vs fuzz training lock ${lock}`,
      options: {
        cpu: [0, 0],
        format: 'training',
        timer: 0,
        stage,
        oaths: pair,
        stanceLock: lock,
      },
      fuzz: [true, true],
    };
  }
  return {
    label: `fuzz vs fuzz continuous on ${stage}`,
    options: {
      cpu: [0, 0],
      format: 'continuous',
      lives: 3,
      timer: 1800,
      stage,
      oaths: pair,
    },
    fuzz: [true, true],
    meter: 10000,
  };
}

function withMeter(world: WorldState, meter: number): WorldState {
  const extension = JSON.parse(world.extensionState!) as {
    duel: { knights: Record<string, { meter: number }> };
  };
  for (const knight of Object.values(extension.duel.knights)) knight.meter = meter;
  world.extensionState = JSON.stringify(extension);
  return world;
}

function runMatch(id: number): GoldenMatch {
  const plan = scenario(id);
  const fuzzers = [new Fuzzer(0x9e3779b9 ^ (id * 7919)), new Fuzzer(0x85ebca6b ^ (id * 104729))];
  let world: WorldState = createDuel(plan.options, 1000 + id);
  if (plan.meter) world = withMeter(world, plan.meter);
  const checkpoints: string[] = [];
  let frames = 0;
  for (; frames < MAX_FRAMES; frames++) {
    const byFighterId: Record<string, SimInputFrame> = {};
    for (const [slot, playerId] of IDS.entries()) {
      byFighterId[playerId] = plan.fuzz[slot] ? fuzzers[slot]!.sample(world.frame) : neutral(world.frame);
    }
    world = stepDuel(world, { frame: world.frame, byFighterId }).state;
    for (const event of duelData(world)?.events ?? []) coverage.set(event.type, (coverage.get(event.type) ?? 0) + 1);
    if (world.fighters.some((fighter) => fighter.attack)) {
      for (const fighter of world.fighters) {
        if (fighter.attack?.frame === 0)
          coverage.set(fighter.attack.attackId, (coverage.get(fighter.attack.attackId) ?? 0) + 1);
      }
    }
    if (frames % CHECKPOINT === 0) checkpoints.push(hashWorldState(world));
    if (duelData(world)?.phase === 'over') break;
  }
  return {
    id,
    label: plan.label,
    frames,
    checkpoints,
    final: hashWorldState(world),
  };
}

function main(): void {
  const record = process.argv.includes('--record');
  const matches = Array.from({ length: MATCHES }, (_, id) => runMatch(id));
  const events = [...coverage.entries()].sort(([a], [b]) => a.localeCompare(b));
  console.log(`GOLDEN COVERAGE ${events.map(([key, count]) => `${key}=${count}`).join(' ')}`);
  if (record || !existsSync(GOLDEN_PATH)) {
    const file: GoldenFile = { version: REPLAY_VERSION, matches };
    writeFileSync(GOLDEN_PATH, JSON.stringify(file, null, 2) + '\n');
    console.log(`GOLDEN RECORDED ${matches.length} matches for ${REPLAY_VERSION}`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile;
  assert.equal(
    golden.version,
    REPLAY_VERSION,
    'Golden hashes belong to another replay version; re-record deliberately with --record',
  );
  for (const match of matches) {
    const expected = golden.matches[match.id]!;
    for (const [index, hash] of match.checkpoints.entries()) {
      assert.equal(
        hash,
        expected.checkpoints[index],
        `Match ${match.id} (${match.label}) diverged by frame ${index * CHECKPOINT}`,
      );
    }
    assert.equal(match.frames, expected.frames, `Match ${match.id} length changed`);
    assert.equal(match.final, expected.final, `Match ${match.id} final hash changed`);
  }
  const total = matches.reduce((sum, match) => sum + match.frames, 0);
  console.log(`GOLDEN PASS ${matches.length} matches, ${total} frames, identical hashes (${REPLAY_VERSION})`);
}

main();
