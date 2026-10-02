/**
 * Room-code signaling for online duels. Two peers meet on a short code, exchange the WebRTC
 * offer/answer and trickle ICE candidates; the match itself is peer-to-peer.
 *
 * Transports:
 *   - Supabase Realtime Broadcast (default): no tables, a `spectris-room:<CODE>` channel.
 *   - BroadcastChannel (`?signal=local`): same-browser tabs, for local tests without network.
 */
import { ONLINE } from '../content/online.js';

export type SignalMessage =
  | { type: 'join'; from: string }
  | { type: 'offer'; from: string; sdp: RTCSessionDescriptionInit; session: string; payload: string }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'bye'; from: string };

export interface SignalingTransport {
  readonly name: string;
  join(room: string, onMessage: (message: SignalMessage) => void): Promise<void>;
  send(message: SignalMessage): Promise<void>;
  close(): void;
}

/** Unambiguous room-code alphabet (no 0/O/1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomCode(length: number = ONLINE.codeLength): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function normalizeCode(code: string): string {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== ONLINE.codeLength || [...clean].some((c) => !ALPHABET.includes(c))) {
    throw Error(`Room codes are ${ONLINE.codeLength} letters and digits`);
  }
  return clean;
}

class LocalTransport implements SignalingTransport {
  readonly name = 'BroadcastChannel (same browser)';
  private channel: BroadcastChannel | null = null;

  async join(room: string, onMessage: (message: SignalMessage) => void): Promise<void> {
    this.channel = new BroadcastChannel(`${ONLINE.channelPrefix}${room}`);
    this.channel.onmessage = (event) => onMessage(event.data as SignalMessage);
  }

  async send(message: SignalMessage): Promise<void> {
    this.channel?.postMessage(message);
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
  }
}

type RealtimeChannel = import('@supabase/supabase-js').RealtimeChannel;

class SupabaseTransport implements SignalingTransport {
  readonly name = 'Supabase Realtime';
  private channel: RealtimeChannel | null = null;
  private client: import('@supabase/supabase-js').SupabaseClient | null = null;

  async join(room: string, onMessage: (message: SignalMessage) => void): Promise<void> {
    // Loaded on demand so offline play never downloads the client.
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(ONLINE.supabaseUrl, ONLINE.supabaseKey, { auth: { persistSession: false } });
    const channel = this.client.channel(`${ONLINE.channelPrefix}${room}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => onMessage(payload as SignalMessage));
    this.channel = channel;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Signaling server did not answer')), ONLINE.joinTimeoutMs);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(Error(`Signaling ${status.toLowerCase().replace('_', ' ')}`));
        }
      });
    });
  }

  async send(message: SignalMessage): Promise<void> {
    await this.channel?.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  close(): void {
    if (this.channel) void this.client?.removeChannel(this.channel);
    this.channel = null;
  }
}

/** The transport for this page: `?signal=local` forces the same-browser transport. */
export function createTransport(): SignalingTransport {
  const local = typeof location !== 'undefined' && new URLSearchParams(location.search).get('signal') === 'local';
  return local ? new LocalTransport() : new SupabaseTransport();
}
