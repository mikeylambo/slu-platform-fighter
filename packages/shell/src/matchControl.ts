export type MatchPauseReason = 'manual' | 'controller-lost' | 'network-lost' | null;
export type ParticipantConnectionState = 'connected' | 'controller-lost' | 'network-lost' | 'forfeited' | 'cpu-takeover';

export interface MatchControlPolicy {
  pauseOnControllerLoss: boolean;
  pauseOnNetworkLoss: boolean;
  allowCpuTakeover: boolean;
  /** Local/online policy when a participant cannot return. */
  disconnectResolution: 'wait' | 'forfeit' | 'cpu-takeover';
}

export const DEFAULT_MATCH_CONTROL_POLICY: MatchControlPolicy = {
  pauseOnControllerLoss: true,
  pauseOnNetworkLoss: true,
  allowCpuTakeover: false,
  disconnectResolution: 'wait',
};

export interface ParticipantControlStatus {
  participantId: string;
  controllerId: string | null;
  connection: ParticipantConnectionState;
}

export interface MatchControlState {
  paused: boolean;
  pauseReason: MatchPauseReason;
  pausedByParticipantId: string | null;
  participants: Readonly<Record<string, ParticipantControlStatus>>;
}

export interface MatchControlEvent {
  type: 'pause' | 'resume' | 'controller-lost' | 'controller-restored' | 'network-lost' | 'network-restored' | 'forfeit' | 'cpu-takeover';
  participantId: string | null;
}

function cloneParticipants(input: Readonly<Record<string, ParticipantControlStatus>>): Record<string, ParticipantControlStatus> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([id, status]) => [id, { ...status }]));
}

export function createMatchControlState(participantsInput: readonly { participantId: string; controllerId: string | null }[]): MatchControlState {
  const participants: Record<string, ParticipantControlStatus> = {};
  for (const participant of [...participantsInput].sort((a, b) => a.participantId.localeCompare(b.participantId))) {
    if (!participant.participantId || participants[participant.participantId]) throw new Error(`duplicate/invalid match-control participant ${participant.participantId}`);
    participants[participant.participantId] = { ...participant, connection: 'connected' };
  }
  if (Object.keys(participants).length < 2) throw new Error('match control requires at least two participants');
  return { paused: false, pauseReason: null, pausedByParticipantId: null, participants };
}

export class MatchControlSession {
  private state: MatchControlState;
  readonly policy: MatchControlPolicy;
  private readonly events: MatchControlEvent[] = [];

  constructor(initial: MatchControlState, policy: MatchControlPolicy = DEFAULT_MATCH_CONTROL_POLICY) {
    if (policy.disconnectResolution === 'cpu-takeover' && !policy.allowCpuTakeover) throw new Error('cpu-takeover resolution requires allowCpuTakeover');
    this.state = { ...initial, participants: cloneParticipants(initial.participants) };
    this.policy = { ...policy };
  }

  get snapshot(): MatchControlState { return structuredClone(this.state); }
  drainEvents(): MatchControlEvent[] { return this.events.splice(0); }

  requestPause(participantId: string | null = null): void {
    if (participantId !== null) this.requireParticipant(participantId);
    if (this.state.paused) return;
    this.state = { ...this.state, paused: true, pauseReason: 'manual', pausedByParticipantId: participantId };
    this.events.push({ type: 'pause', participantId });
  }

  resume(): void {
    if (!this.state.paused) return;
    const unresolved = Object.values(this.state.participants).some((status) => status.connection === 'controller-lost' || status.connection === 'network-lost');
    if (unresolved && this.state.pauseReason !== 'manual') throw new Error('cannot resume while required participant connection is unresolved');
    this.state = { ...this.state, paused: false, pauseReason: null, pausedByParticipantId: null };
    this.events.push({ type: 'resume', participantId: null });
  }

  controllerLost(participantId: string, controllerId?: string): void {
    const status = this.requireParticipant(participantId);
    if (controllerId !== undefined && status.controllerId !== controllerId) return;
    this.setParticipant(participantId, { ...status, connection: 'controller-lost' });
    this.events.push({ type: 'controller-lost', participantId });
    if (this.policy.pauseOnControllerLoss) this.pauseFor('controller-lost', participantId);
  }

  controllerRestored(participantId: string, controllerId: string): void {
    const status = this.requireParticipant(participantId);
    this.setParticipant(participantId, { ...status, controllerId, connection: 'connected' });
    this.events.push({ type: 'controller-restored', participantId });
  }

  networkLost(participantId: string): void {
    const status = this.requireParticipant(participantId);
    this.setParticipant(participantId, { ...status, connection: 'network-lost' });
    this.events.push({ type: 'network-lost', participantId });
    if (this.policy.pauseOnNetworkLoss) this.pauseFor('network-lost', participantId);
  }

  networkRestored(participantId: string): void {
    const status = this.requireParticipant(participantId);
    this.setParticipant(participantId, { ...status, connection: 'connected' });
    this.events.push({ type: 'network-restored', participantId });
  }

  resolveDisconnect(participantId: string): ParticipantConnectionState {
    const status = this.requireParticipant(participantId);
    if (status.connection !== 'controller-lost' && status.connection !== 'network-lost') return status.connection;
    if (this.policy.disconnectResolution === 'wait') return status.connection;
    if (this.policy.disconnectResolution === 'forfeit') {
      this.setParticipant(participantId, { ...status, connection: 'forfeited' });
      this.events.push({ type: 'forfeit', participantId });
      return 'forfeited';
    }
    if (!this.policy.allowCpuTakeover) throw new Error('cpu takeover is disabled');
    this.setParticipant(participantId, { ...status, connection: 'cpu-takeover', controllerId: null });
    this.events.push({ type: 'cpu-takeover', participantId });
    return 'cpu-takeover';
  }

  private pauseFor(reason: Exclude<MatchPauseReason, 'manual' | null>, participantId: string): void {
    if (this.state.paused && this.state.pauseReason === 'manual') return;
    const newlyPaused = !this.state.paused;
    this.state = { ...this.state, paused: true, pauseReason: reason, pausedByParticipantId: participantId };
    if (newlyPaused) this.events.push({ type: 'pause', participantId });
  }

  private requireParticipant(participantId: string): ParticipantControlStatus {
    const status = this.state.participants[participantId];
    if (!status) throw new Error(`unknown match-control participant ${participantId}`);
    return status;
  }

  private setParticipant(participantId: string, status: ParticipantControlStatus): void {
    this.state = { ...this.state, participants: { ...this.state.participants, [participantId]: status } };
  }
}
