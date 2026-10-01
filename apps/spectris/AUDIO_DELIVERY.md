# Spectris Duellum — audio delivery

The build runs with synthesized music and effects. Replace these through `public/audio.manifest.json`; paths are relative to the deployed root. Use Ogg or MP3 for web delivery, retain 48 kHz/24-bit WAV masters outside the runtime. No recorded voice has been supplied.

## Music stems

For each stage below, deliver four files named `audio/music/<stage>-<layer>.ogg`. Layers are `base`, `percussion`, `lead`, `kindle`. All four must have identical length, sample start, tempo, and loop boundaries, with no leading silence. Working synth tempo is 150 BPM; authored tracks may choose another tempo once their beat metadata is integrated. Suggested delivery: 32 bars, 51.2 seconds at 150 BPM, loop 0–51.2 seconds.

| Stage | Intent |
| --- | --- |
| mirror-sanctum | Restrained, ceremonial mirror duel |
| eclipse | Low distorted pulse and heat |
| fault-screen | Brittle digital percussion and broken harmonics |
| stillwater | Sparse bell tones, patient space |
| bell-foundry | Heavy struck metal, steady machinery |
| skyreach | Air, height, rising phrases |
| hollow-throne | Empty grandeur and low pressure |
| unsworn | Sanctum motif fractured and reassembled |
| pilgrimage | A coherent journey through the biome motifs |

Manifest example: `"stems": {"eclipse": ["audio/music/eclipse-base.ogg", "audio/music/eclipse-percussion.ogg", "audio/music/eclipse-lead.ogg", "audio/music/eclipse-kindle.ogg"]}`. The runtime starts stems together and crossfades their gains on Fractures/Kindle. Synthesized Clash stingers wait at most 100 ms for the next beat. Authored tempo/beat metadata is a follow-up integration item.

## Effects

Deliver one-shots without loop points, trim silence, and leave a short natural tail. Manifest SFX keys map directly to URLs. Layered variants may be combined into one file for this first delivery.

| Manifest key / filename | Target length | Intent |
| --- | --- | --- |
| hit / hit.ogg | 0.15–0.35s | Steel bite, clear transient |
| clank / clank.ogg | 0.2–0.5s | Equal blades meet |
| clash / clash.ogg | 0.4–0.8s | Locked steel, suspended pressure |
| clash-resolve / clash-resolve.ogg | 0.25–0.6s | Read resolved, release tension |
| parry / parry.ogg | 0.2–0.4s | Sharp, unmistakable successful read |
| block / block.ogg | 0.12–0.25s | Duller protected impact |
| guard-break / guard-break.ogg | 0.4–0.8s | Integrity gives way |
| shatter / shatter.ogg | 0.5–1.0s | Helm burst plus soul-flame discharge |
| fracture / fracture.ogg | 0.5–0.9s | Armor fall and extinguished flame |
| kindle / kindle.ogg | 0.7–1.2s | Sudden white-hot ignition |
| stance / stance.ogg | 0.2–0.4s | Unfurl with metal/cloth accent |
| jump / jump.ogg | 0.1–0.25s | Compact breath of flame |
| throw / throw.ogg | 0.2–0.5s | Gauntlet release and displaced air |
| pummel / pummel.ogg | 0.1–0.2s | Close siphon pulse |
| blade-hit / blade-hit.ogg | 0.15–0.35s | Spinning blade contact |
| recall / recall.ogg | 0.3–0.5s | Blade returning to gauntlet |
| round-win / round-win.ogg | 0.7–1.5s | Severe, restrained victory |
| match-win / match-win.ogg | 1–2s | A reclaimed fragment |
| menu / menu.ogg | 0.08–0.2s | Quiet confirmation |

Additional production cues with general synthesized fallbacks: light/heavy swing variants, Strain-tier crack, glide loop, landing, ledge grab, Sling throw, Rift, Veil Step, Anchor shockwave, respawn, and Kindle end. Move-start, landing, ledge, respawn, and Strain-tier events are hooked up. Dedicated glide/Kindle loops and light/heavy variation remain production polish.

## Michael's voice session

Deliver dry mono WAV masters; runtime files can be mono Ogg. Leave no baked reverb. Reflection processing should preserve intelligibility: subtle pitch/formant shift, short dark delay, restrained distortion.

| Files | Length each | Direction |
| --- | --- | --- |
| voice/start-01 … start-08.ogg | 1–3s | Eight restrained challenges, masked and close |
| voice/reflection-01 … reflection-08.ogg | 1–3s | Matching answers, same voice with reflection processing |
| voice/kindle-01 … kindle-04.ogg | 0.4–1.2s | Four nonverbal ignition cries |
| voice/death-breath.ogg | 0.5–1.5s | Flame failing, no theatrical shout |

Voice keys use `voice:<name>` in the manifest. The loader supports them; round-start/result hooks, separate voice volume, and a basic lower-pitched/filtered reflection path are present. Final line selection, subtitles, distortion/delay tuning, and recording QA await the actual delivery.

## Complete master-file inventory

The original production inventory is retained below. Runtime manifest keys map these masters to compressed web deliveries; filenames need not match the keys.

## Music

| Filename | Target length | Loop | Intent |
|---|---|---|---|
| music/mirror-sanctum/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/mirror-sanctum/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/mirror-sanctum/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/mirror-sanctum/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/eclipse/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/eclipse/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/eclipse/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/eclipse/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/fault-screen/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/fault-screen/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/fault-screen/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/fault-screen/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/stillwater/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/stillwater/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/stillwater/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/stillwater/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/bell-foundry/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/bell-foundry/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/bell-foundry/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/bell-foundry/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/skyreach/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/skyreach/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/skyreach/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/skyreach/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/hollow-throne/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/hollow-throne/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/hollow-throne/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/hollow-throne/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/unsworn/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/unsworn/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/unsworn/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/unsworn/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |
| music/pilgrimage/base.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Restrained atmosphere; zero Fractures |
| music/pilgrimage/percussion.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | First Fracture escalation |
| music/pilgrimage/lead.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Second Fracture escalation |
| music/pilgrimage/kindle.wav | 32 bars at final BPM | [0, 32 bars), sample-aligned across stems | Kindle / Sudden Death intensity |

## Sound effects

| Filename | Target length | Loop | Intent |
|---|---|---|---|
| sfx/blade/swing-light.wav | 0.1–1.5s | None | Swing light |
| sfx/blade/swing-heavy.wav | 0.1–1.5s | None | Swing heavy |
| sfx/blade/hit-light.wav | 0.1–1.5s | None | Hit light |
| sfx/blade/hit-heavy.wav | 0.1–1.5s | None | Hit heavy |
| sfx/blade/hit-shatter.wav | 0.1–1.5s | None | Hit shatter |
| sfx/blade/clash-lock.wav | 0.1–1.5s | None | Clash lock |
| sfx/blade/clash-win.wav | 0.1–1.5s | None | Clash win |
| sfx/armor/helm-crack-25.wav | 0.1–1.5s | None | Helm crack 25 |
| sfx/armor/helm-crack-50.wav | 0.1–1.5s | None | Helm crack 50 |
| sfx/armor/helm-crack-100.wav | 0.1–1.5s | None | Helm crack 100 |
| sfx/armor/helm-crack-150.wav | 0.1–1.5s | None | Helm crack 150 |
| sfx/armor/hairline-chip.wav | 0.1–1.5s | None | Hairline chip |
| sfx/armor/guard-break.wav | 0.1–1.5s | None | Guard break |
| sfx/armor/helm-shatter.wav | 0.1–1.5s | None | Helm shatter |
| sfx/flame/ignite.wav | 0.1–1.5s | None | Ignite |
| sfx/flame/unfurl-wings.wav | 0.1–1.5s | None | Unfurl wings |
| sfx/flame/unfurl-cape.wav | 0.1–1.5s | None | Unfurl cape |
| sfx/flame/kindle-start.wav | 0.1–1.5s | None | Kindle start |
| sfx/flame/kindle-loop.wav | 2–4s | Full file, seamless | Kindle loop |
| sfx/flame/kindle-end.wav | 0.1–1.5s | None | Kindle end |
| sfx/flame/respawn-ignite.wav | 0.1–1.5s | None | Respawn ignite |
| sfx/movement/jump.wav | 0.1–1.5s | None | Jump |
| sfx/movement/midair-jump.wav | 0.1–1.5s | None | Midair jump |
| sfx/movement/glide-loop.wav | 2–4s | Full file, seamless | Glide loop |
| sfx/movement/landing.wav | 0.1–1.5s | None | Landing |
| sfx/movement/ledge-grab.wav | 0.1–1.5s | None | Ledge grab |
| sfx/special/blade-sling-throw.wav | 0.1–1.5s | None | Blade sling throw |
| sfx/special/blade-sling-return.wav | 0.1–1.5s | None | Blade sling return |
| sfx/special/rift.wav | 0.1–1.5s | None | Rift |
| sfx/special/veil-step.wav | 0.1–1.5s | None | Veil step |
| sfx/special/anchor-shockwave.wav | 0.1–1.5s | None | Anchor shockwave |
| sfx/ui/move.wav | 0.1–1.5s | None | Move |
| sfx/ui/confirm.wav | 0.1–1.5s | None | Confirm |
| sfx/ui/back.wav | 0.1–1.5s | None | Back |
| sfx/ui/fracture-pip-break.wav | 0.1–1.5s | None | Fracture pip break |
| sfx/ui/round-win.wav | 0.1–1.5s | None | Round win |
| sfx/ui/results.wav | 0.1–1.5s | None | Results |

## Voice

| Filename | Target length | Loop | Intent |
|---|---|---|---|
| voice/round-start-01.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-01.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-02.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-02.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-03.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-03.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-04.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-04.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-05.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-05.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-06.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-06.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-07.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-07.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/round-start-08.wav | 1–3s | None | Masked challenge, before DUEL |
| voice/reflection-08.wav | 1–3s | None | Matched response; deliver dry for in-engine distortion |
| voice/kindle-01.wav | 0.4–1.2s | None | Nonverbal ignition cry |
| voice/kindle-02.wav | 0.4–1.2s | None | Nonverbal ignition cry |
| voice/kindle-03.wav | 0.4–1.2s | None | Nonverbal ignition cry |
| voice/kindle-04.wav | 0.4–1.2s | None | Nonverbal ignition cry |
| voice/death-breath.wav | 0.5–1.5s | None | Flame extinguishes |
