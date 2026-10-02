/**
 * Online configuration. The Supabase URL and publishable key are public by design (they only
 * allow what the project's policies allow); Realtime Broadcast needs no tables. Override with
 * VITE_SUPABASE_URL / VITE_SUPABASE_KEY at build time.
 */
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const ONLINE = {
  supabaseUrl: env.VITE_SUPABASE_URL ?? 'https://iysvarvkltihgosbhtaa.supabase.co',
  supabaseKey: env.VITE_SUPABASE_KEY ?? 'sb_publishable_7Kxs-F6HGMgZmb86V1b9_A_qtyUerCh',
  channelPrefix: 'spectris-room:',
  codeLength: 5,
  joinTimeoutMs: 10000,
  /** Public STUN servers. TURN (relay) is a follow-up for strict NATs. */
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ] as RTCIceServer[],
  /** How long the host keeps a room open waiting for a guest. */
  hostTimeoutMs: 5 * 60 * 1000,
} as const;
