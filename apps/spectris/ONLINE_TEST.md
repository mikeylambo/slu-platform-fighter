# Online test — two machines, 5 minutes

Online duels use **room codes**: one player creates a room, the other types the code. Signaling runs over Supabase Realtime (the *leaderboards* project, Broadcast only — no tables); the match itself is peer-to-peer WebRTC with rollback netcode and state-hash desync checks.

## You need

- Two computers (or a computer and a friend's computer), each with Chrome.
- The preview URL for the branch.
- Ideally one machine on a **different network** (e.g. phone hotspot) for the second run.

## Steps

1. **Machine A:** open the preview URL → **Online** → **CREATE ROOM**. A 5-character code appears (e.g. `K7QWZ`). Status shows `Room K7QWZ · share this code (Supabase Realtime)`.
2. **Machine B:** open the preview URL → **Online** → type the code → **Join**. Status goes `Joined room … · waiting for host` → `Connecting…`.
3. Both screens start the duel within a few seconds. Status: `Connected · rollback active`.
4. Play for one minute with keyboard P1 controls on each machine (WASD, Space, J, K, L, U, I). Try fast exchanges: jab trades, a grab, a stance switch.
5. Check:
   - [ ] Both players see the same match (positions and hits agree).
   - [ ] No `Desync at frame …` message.
   - [ ] Movement feels responsive at the default 2-frame input delay. If it stutters, try delay 3–4.
6. Repeat once with Machine B on a phone hotspot (different network).

## What to send back

- Pass/fail for each check, and which network setups you tried.
- Any status line you saw that wasn't `Connected · rollback active`.
- If it never connects across networks: that is the strict-NAT case, which needs a TURN relay (the planned follow-up). Same-network success + cross-network failure points straight at it.

## Known limits

- No TURN relay yet, so some corporate / carrier-grade NATs will not connect.
- Manual pairing (paste codes) is still available under *Manual pairing* in the Online panel when no signaling server is reachable.
- Verified here: the same-browser two-tab test (`node scripts/spectris-online-test.mjs`) — real WebRTC, room code, rollback active, zero desyncs. Supabase itself could not be reached from the build container (network policy), so the Supabase transport is untested until you run step 1–3.
