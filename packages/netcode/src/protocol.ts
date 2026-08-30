import { WORLD_BINARY_VERSION } from '../../sim/src/serialize.js';
import type { SimInputFrame } from '../../sim/src/types.js';

export const NETCODE_PROTOCOL_VERSION = 1;

export interface NetHelloPacket {
  type: 'hello';
  protocolVersion: typeof NETCODE_PROTOCOL_VERSION;
  worldBinaryVersion: number;
  gameVersion: string;
  sessionId: string;
  peerId: string;
  participantIds: readonly string[];
  localParticipantIds: readonly string[];
  inputDelayFrames: number;
  contentHash: string;
}

export interface NetInputPacket {
  type: 'input';
  protocolVersion: typeof NETCODE_PROTOCOL_VERSION;
  sessionId: string;
  peerId: string;
  sequence: number;
  participantId: string;
  input: SimInputFrame;
}

export interface NetStateHashPacket {
  type: 'state-hash';
  protocolVersion: typeof NETCODE_PROTOCOL_VERSION;
  sessionId: string;
  peerId: string;
  frame: number;
  hash: string;
}

export interface NetDisconnectPacket {
  type: 'disconnect';
  protocolVersion: typeof NETCODE_PROTOCOL_VERSION;
  sessionId: string;
  peerId: string;
  reason: 'left' | 'timeout' | 'protocol-error' | 'desync';
}

export type NetPacket = NetHelloPacket | NetInputPacket | NetStateHashPacket | NetDisconnectPacket;

export interface HandshakeIdentity {
  gameVersion: string;
  sessionId: string;
  peerId: string;
  participantIds: readonly string[];
  localParticipantIds: readonly string[];
  inputDelayFrames: number;
  contentHash: string;
}

function nonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must be non-empty`);
}

export function createHelloPacket(identity: HandshakeIdentity): NetHelloPacket {
  nonEmpty(identity.gameVersion, 'gameVersion');
  nonEmpty(identity.sessionId, 'sessionId');
  nonEmpty(identity.peerId, 'peerId');
  nonEmpty(identity.contentHash, 'contentHash');
  if (!Number.isInteger(identity.inputDelayFrames) || identity.inputDelayFrames < 0 || identity.inputDelayFrames > 30) throw new Error('inputDelayFrames must be integer in [0, 30]');
  if (identity.participantIds.length < 2 || new Set(identity.participantIds).size !== identity.participantIds.length) throw new Error('participantIds must contain at least two unique ids');
  if (identity.localParticipantIds.length < 1 || new Set(identity.localParticipantIds).size !== identity.localParticipantIds.length) throw new Error('localParticipantIds must be non-empty and unique');
  for (const id of identity.localParticipantIds) if (!identity.participantIds.includes(id)) throw new Error(`local participant ${id} is not in participantIds`);
  return { type: 'hello', protocolVersion: NETCODE_PROTOCOL_VERSION, worldBinaryVersion: WORLD_BINARY_VERSION, ...identity };
}

export interface HandshakeCompatibility {
  compatible: boolean;
  reasons: string[];
}

/** Session/peer ids are deliberately excluded: remote peers must differ there. */
export function compareHandshake(local: NetHelloPacket, remote: NetHelloPacket): HandshakeCompatibility {
  const reasons: string[] = [];
  if (remote.protocolVersion !== local.protocolVersion) reasons.push(`protocol ${remote.protocolVersion} != ${local.protocolVersion}`);
  if (remote.worldBinaryVersion !== local.worldBinaryVersion) reasons.push(`world binary ${remote.worldBinaryVersion} != ${local.worldBinaryVersion}`);
  if (remote.gameVersion !== local.gameVersion) reasons.push(`game version ${remote.gameVersion} != ${local.gameVersion}`);
  if (remote.sessionId !== local.sessionId) reasons.push('session id mismatch');
  if (remote.contentHash !== local.contentHash) reasons.push('content hash mismatch');
  if (remote.inputDelayFrames !== local.inputDelayFrames) reasons.push(`input delay ${remote.inputDelayFrames} != ${local.inputDelayFrames}`);
  if ([...remote.participantIds].sort().join('\0') !== [...local.participantIds].sort().join('\0')) reasons.push('participant roster mismatch');
  if (remote.peerId === local.peerId) reasons.push('peer ids must be distinct');
  const overlap = remote.localParticipantIds.filter((id) => local.localParticipantIds.includes(id));
  if (overlap.length > 0) reasons.push(`participant ownership overlap: ${overlap.join(',')}`);
  return { compatible: reasons.length === 0, reasons };
}

export function validateNetPacket(packet: NetPacket): void {
  if (packet.protocolVersion !== NETCODE_PROTOCOL_VERSION) throw new Error(`unsupported netcode protocol ${packet.protocolVersion}`);
  nonEmpty(packet.sessionId, 'packet sessionId');
  nonEmpty(packet.peerId, 'packet peerId');
  if (packet.type === 'input') {
    if (!Number.isInteger(packet.sequence) || packet.sequence < 0) throw new Error('input packet sequence must be non-negative integer');
    if (!Number.isInteger(packet.input.frame) || packet.input.frame < 0) throw new Error('input packet frame must be non-negative integer');
    nonEmpty(packet.participantId, 'input participantId');
  }
  if (packet.type === 'state-hash') {
    if (!Number.isInteger(packet.frame) || packet.frame < 0) throw new Error('state hash frame must be non-negative integer');
    if (!/^[0-9a-f]{16}$/i.test(packet.hash)) throw new Error('state hash must be 16 hex characters');
  }
}
