import type { FighterState, ItemState, LocomotionState, MatchRuntimeState, OwnedEntityState, SimInputFrame, StageLedge, StageSurface, WorldState } from './types.js';

export const WORLD_BINARY_VERSION = 15;

const locomotionCode: Record<LocomotionState, number> = {
  idle: 0, walk: 1, dash: 2, run: 3, turn: 4, crouch: 5, 'jump-squat': 6, airborne: 7,
  landing: 8, 'ledge-hang': 9, 'air-dodge': 10, 'spot-dodge': 11, roll: 12,
  'tech-in-place': 13, 'tech-roll': 14, knockdown: 15, grabbed: 16, respawn: 17,
};

class ByteWriter {
  private readonly bytes: number[] = [];
  private readonly encoder = new TextEncoder();
  u8(value: number) { this.bytes.push(value & 0xff); }
  u16(value: number) { const v = value & 0xffff; this.u8(v); this.u8(v >>> 8); }
  i16(value: number) { this.u16(value & 0xffff); }
  u32(value: number) { const v = value >>> 0; this.u8(v); this.u8(v >>> 8); this.u8(v >>> 16); this.u8(v >>> 24); }
  i32(value: number) { this.u32(value >>> 0); }
  i64(value: number) {
    if (!Number.isSafeInteger(value)) throw new Error(`binary state requires safe integer, got ${value}`);
    const v = BigInt.asUintN(64, BigInt(value));
    for (let shift = 0n; shift < 64n; shift += 8n) this.u8(Number((v >> shift) & 0xffn));
  }
  bool(value: boolean) { this.u8(value ? 1 : 0); }
  string(value: string) { const encoded = this.encoder.encode(value); if (encoded.length > 0xffff) throw new Error('binary state string exceeds 65535 bytes'); this.u16(encoded.length); for (const byte of encoded) this.u8(byte); }
  finish(): Uint8Array { return Uint8Array.from(this.bytes); }
}

function writeInput(writer: ByteWriter, input: SimInputFrame) { writer.i32(input.frame); writer.i16(input.moveX); writer.i16(input.moveY); writer.bool(input.jumpPressed); writer.bool(input.jumpHeld); writer.bool(Boolean(input.attackPressed)); writer.bool(Boolean(input.specialPressed)); writer.bool(Boolean(input.grabPressed)); writer.i16(input.smashX ?? 0); writer.i16(input.smashY ?? 0); writer.bool(input.dodgePressed); writer.bool(input.shieldHeld); }
function writeSurface(writer: ByteWriter, surface: StageSurface) { writer.string(surface.id); writer.u8(surface.kind === 'solid' ? 0 : 1); writer.i64(surface.y); writer.i64(surface.xMin); writer.i64(surface.xMax); }
function writeLedge(writer: ByteWriter, ledge: StageLedge) { writer.string(ledge.id); writer.i64(ledge.x); writer.i64(ledge.y); writer.i16(ledge.inward); }
function writeOptionalString(writer: ByteWriter, value: string | null) { writer.bool(value !== null); if (value !== null) writer.string(value); }
function writeFighter(writer: ByteWriter, fighter: FighterState) {
  writer.string(fighter.id); writer.string(fighter.definitionId); writer.i64(fighter.x); writer.i64(fighter.y); writer.i64(fighter.vx); writer.i64(fighter.vy);
  writer.bool(fighter.grounded); writer.bool(fighter.groundSurfaceId !== null); if (fighter.groundSurfaceId !== null) writer.string(fighter.groundSurfaceId);
  writer.i16(fighter.facing); writer.u8(locomotionCode[fighter.locomotion]); writer.u32(fighter.locomotionFrame); writer.u8(fighter.jumpsRemaining); writer.bool(fighter.fastFalling);
  writer.u16(fighter.dropThroughFrames); writer.u16(fighter.jumpBufferFrames); writeOptionalString(writer, fighter.ledgeId); writer.u16(fighter.ledgeRegrabLockoutFrames); writer.u16(fighter.invulnerableFrames); writer.u16(fighter.dodgeCooldownFrames); writer.u16(fighter.techBufferFrames); writer.u16(fighter.landingLagFrames);
  writer.u32(fighter.percentTenths); writer.u16(fighter.hitlagFrames); writer.u16(fighter.hitstunFrames); writer.bool(fighter.attack !== null);
  if (fighter.attack !== null) { writer.string(fighter.attack.attackId); writer.u16(fighter.attack.frame); const hitTargets = [...fighter.attack.hitTargets].sort(); writer.u16(hitTargets.length); for (const target of hitTargets) writer.string(target); }
  writer.bool(fighter.shielding); writer.u16(fighter.shieldHealth); writer.u16(fighter.shieldStunFrames); writer.u16(fighter.shieldRegenDelayFrames); writeOptionalString(writer, fighter.grabTargetId); writeOptionalString(writer, fighter.grabbedById); writer.u16(fighter.grabFrames); writer.bool(fighter.grabAction !== null);
  if (fighter.grabAction !== null) { writer.string(fighter.grabAction.actionId); writer.u16(fighter.grabAction.frame); }
  writeOptionalString(writer, fighter.lastHitById); writer.i32(fighter.lastHitFrame); writer.u8(fighter.stocks); writer.bool(fighter.eliminated); writer.u16(fighter.respawnFrames);
  if (fighter.inputHistory.length > 0xffff) throw new Error('input history exceeds binary format capacity'); writer.u16(fighter.inputHistory.length); for (const input of fighter.inputHistory) writeInput(writer, input);
}
function writeEntity(writer: ByteWriter, entity: OwnedEntityState) { writer.string(entity.id); writer.string(entity.definitionId); writer.string(entity.ownerId); writer.string(entity.ownerDefinitionId); writer.i64(entity.x); writer.i64(entity.y); writer.i64(entity.vx); writer.i64(entity.vy); writer.i16(entity.facing); writer.u16(entity.ageFrames); writer.u16(entity.lifetimeFrames); writer.u8(entity.hitsRemaining); const targets=[...entity.hitTargets].sort(); writer.u16(targets.length); for(const target of targets) writer.string(target); }
function writeItem(writer: ByteWriter, item: ItemState) { writer.string(item.id); writer.string(item.definitionId); writer.i64(item.x); writer.i64(item.y); writer.i64(item.vx); writer.i64(item.vy); writeOptionalString(writer,item.holderId); writer.u16(item.usesRemaining); writer.u32(item.ageFrames); }
function writeMatch(writer: ByteWriter, match: MatchRuntimeState | undefined) { writer.bool(match !== undefined); if (!match) return; writer.u8(match.mode === 'stock' ? 0 : match.mode === 'time' ? 1 : 2); writer.bool(match.framesRemaining !== null); if (match.framesRemaining !== null) writer.u32(match.framesRemaining); const scores=Object.entries(match.scores).sort(([a],[b])=>a.localeCompare(b)); writer.u16(scores.length); for(const [participantId,score] of scores){writer.string(participantId);writer.i32(score);} writeOptionalString(writer,match.winningTeamId); writer.bool(match.suddenDeath); writer.bool(match.ended); }

export function serializeWorldState(state: WorldState): Uint8Array {
  const writer = new ByteWriter(); writer.u8(0x53); writer.u8(0x4c); writer.u8(0x50); writer.u8(0x46); writer.u16(WORLD_BINARY_VERSION); writer.u32(state.frame); writer.u32(state.seed); writeOptionalString(writer,state.winnerId); writeMatch(writer,state.match);
  writer.u32(state.nextEntitySerial ?? 1); writer.u32(state.nextItemSerial ?? 1);
  const surfaces=[...state.surfaces].sort((a,b)=>a.id.localeCompare(b.id)); writer.u16(surfaces.length); for(const surface of surfaces)writeSurface(writer,surface);
  const ledges=[...state.ledges].sort((a,b)=>a.id.localeCompare(b.id)); writer.u16(ledges.length); for(const ledge of ledges)writeLedge(writer,ledge);
  const fighters=[...state.fighters].sort((a,b)=>a.id.localeCompare(b.id)); writer.u16(fighters.length); for(const fighter of fighters)writeFighter(writer,fighter);
  const entities=[...(state.entities??[])].sort((a,b)=>a.id.localeCompare(b.id)); writer.u16(entities.length); for(const entity of entities)writeEntity(writer,entity);
  const items=[...(state.items??[])].sort((a,b)=>a.id.localeCompare(b.id)); writer.u16(items.length); for(const item of items)writeItem(writer,item);
  return writer.finish();
}
