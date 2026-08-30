import type { FighterState, LocomotionState, SimInputFrame, StageSurface, WorldState } from './types.js';

export const WORLD_BINARY_VERSION = 1;

const locomotionCode: Record<LocomotionState, number> = {
  idle: 0,
  walk: 1,
  dash: 2,
  run: 3,
  turn: 4,
  crouch: 5,
  'jump-squat': 6,
  airborne: 7,
  landing: 8,
};

class ByteWriter {
  private readonly bytes: number[] = [];
  private readonly encoder = new TextEncoder();

  u8(value: number) {
    this.bytes.push(value & 0xff);
  }

  u16(value: number) {
    const v = value & 0xffff;
    this.u8(v);
    this.u8(v >>> 8);
  }

  i16(value: number) {
    this.u16(value & 0xffff);
  }

  u32(value: number) {
    const v = value >>> 0;
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }

  i32(value: number) {
    this.u32(value >>> 0);
  }

  i64(value: number) {
    if (!Number.isSafeInteger(value)) throw new Error(`binary state requires safe integer, got ${value}`);
    const v = BigInt.asUintN(64, BigInt(value));
    for (let shift = 0n; shift < 64n; shift += 8n) {
      this.u8(Number((v >> shift) & 0xffn));
    }
  }

  bool(value: boolean) {
    this.u8(value ? 1 : 0);
  }

  string(value: string) {
    const encoded = this.encoder.encode(value);
    if (encoded.length > 0xffff) throw new Error('binary state string exceeds 65535 bytes');
    this.u16(encoded.length);
    for (const byte of encoded) this.u8(byte);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function writeInput(writer: ByteWriter, input: SimInputFrame) {
  writer.i32(input.frame);
  writer.i16(input.moveX);
  writer.i16(input.moveY);
  writer.bool(input.jumpPressed);
  writer.bool(input.jumpHeld);
}

function writeSurface(writer: ByteWriter, surface: StageSurface) {
  writer.string(surface.id);
  writer.u8(surface.kind === 'solid' ? 0 : 1);
  writer.i64(surface.y);
  writer.i64(surface.xMin);
  writer.i64(surface.xMax);
}

function writeFighter(writer: ByteWriter, fighter: FighterState) {
  writer.string(fighter.id);
  writer.i64(fighter.x);
  writer.i64(fighter.y);
  writer.i64(fighter.vx);
  writer.i64(fighter.vy);
  writer.bool(fighter.grounded);
  writer.bool(fighter.groundSurfaceId !== null);
  if (fighter.groundSurfaceId !== null) writer.string(fighter.groundSurfaceId);
  writer.i8?.(0);
}

function writeFighterStable(writer: ByteWriter, fighter: FighterState) {
  writer.string(fighter.id);
  writer.i64(fighter.x);
  writer.i64(fighter.y);
  writer.i64(fighter.vx);
  writer.i64(fighter.vy);
  writer.bool(fighter.grounded);
  writer.bool(fighter.groundSurfaceId !== null);
  if (fighter.groundSurfaceId !== null) writer.string(fighter.groundSurfaceId);
  writer.i16(fighter.facing);
  writer.u8(locomotionCode[fighter.locomotion]);
  writer.u32(fighter.locomotionFrame);
  writer.u8(fighter.jumpsRemaining);
  writer.bool(fighter.fastFalling);
  writer.u16(fighter.dropThroughFrames);
  writer.u16(fighter.jumpBufferFrames);
  if (fighter.inputHistory.length > 0xffff) throw new Error('input history exceeds binary format capacity');
  writer.u16(fighter.inputHistory.length);
  for (const input of fighter.inputHistory) writeInput(writer, input);
}

export function serializeWorldState(state: WorldState): Uint8Array {
  const writer = new ByteWriter();

  // ASCII "SLPF" followed by an explicit format version.
  writer.u8(0x53);
  writer.u8(0x4c);
  writer.u8(0x50);
  writer.u8(0x46);
  writer.u16(WORLD_BINARY_VERSION);
  writer.u32(state.frame);
  writer.u32(state.seed);

  const surfaces = [...state.surfaces].sort((a, b) => a.id.localeCompare(b.id));
  writer.u16(surfaces.length);
  for (const surface of surfaces) writeSurface(writer, surface);

  const fighters = [...state.fighters].sort((a, b) => a.id.localeCompare(b.id));
  writer.u16(fighters.length);
  for (const fighter of fighters) writeFighterStable(writer, fighter);

  return writer.finish();
}
