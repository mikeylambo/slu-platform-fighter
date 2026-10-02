/**
 * Controller diagnostics: every connected pad's mapping, live sticks against the active
 * deadzone, live buttons with the Spectris action each one performs, and a per-button
 * latency estimate (browser input timestamp → the frame that first sees the press).
 */
const ACTIONS: Record<number, string> = {
  0: 'Attack',
  1: 'Special',
  2: 'Jump',
  3: 'Jump',
  4: 'Stance',
  5: 'Grab',
  6: '—',
  7: 'Guard / Evade',
  8: '—',
  9: 'Pause',
  12: 'Up',
  13: 'Down',
  14: 'Left',
  15: 'Right',
};

interface Latency {
  samples: number[];
  pressed: boolean;
}

const median = (values: number[]): number => {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

export function openGamepadDiagnostics(deadzone: number): () => void {
  const panel = document.createElement('section');
  panel.className = 'pad-diagnostics';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Controller diagnostics');
  panel.innerHTML = `<header><div><div class="eyebrow">Controller test</div><h2>Every input, as the game sees it.</h2></div><button class="close" aria-label="Close">×</button></header><div class="pad-list"></div><p class="pad-note">Latency is measured from the browser's input timestamp to the first animation frame that observes the change. It excludes the controller's own USB/Bluetooth delay and the display. Press each button a few times for a stable median.</p>`;
  document.body.append(panel);
  const list = panel.querySelector<HTMLDivElement>('.pad-list')!;
  const latency = new Map<string, Latency>();
  let running = true;
  const close = () => {
    running = false;
    panel.remove();
  };
  panel.querySelector<HTMLButtonElement>('.close')!.onclick = close;

  const stick = (x: number, y: number, label: string) => {
    const r = 46;
    const dz = deadzone * r;
    const live = Math.hypot(x, y) > deadzone;
    return `<figure class="stick"><svg viewBox="-60 -60 120 120" aria-label="${label}: ${x.toFixed(2)}, ${y.toFixed(2)}"><circle r="${r}" class="ring"/><circle r="${dz}" class="deadzone"/><line x1="0" y1="0" x2="${x * r}" y2="${y * r}" class="vector"/><circle cx="${x * r}" cy="${y * r}" r="6" class="${live ? 'dot live' : 'dot'}"/></svg><figcaption>${label}<br>${x.toFixed(2)}, ${y.toFixed(2)}</figcaption></figure>`;
  };

  function frame(now: number) {
    if (!running) return;
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => !!pad);
    if (!pads.length) {
      list.innerHTML = `<p class="pad-empty">No controller detected. Connect one and press any button — browsers only expose a pad after its first input.</p>`;
    } else {
      list.innerHTML = pads
        .map((pad) => {
          const buttons = pad.buttons
            .map((button, index) => {
              const key = `${pad.index}:${index}`;
              const record = latency.get(key) ?? { samples: [], pressed: false };
              if (button.pressed && !record.pressed) {
                record.samples.push(Math.max(0, now - pad.timestamp));
                if (record.samples.length > 15) record.samples.shift();
              }
              record.pressed = button.pressed;
              latency.set(key, record);
              const ms = median(record.samples);
              return `<li class="${button.pressed ? 'on' : ''}"><b>B${index}</b><span>${ACTIONS[index] ?? '—'}</span><em>${Number.isNaN(ms) ? '·' : `${ms.toFixed(1)} ms`}</em></li>`;
            })
            .join('');
          const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
          return `<article class="pad"><h3>Pad ${pad.index + 1} · ${pad.id.replace(/\(.*?\)/g, '').trim() || 'Unknown'}</h3><p class="${pad.mapping === 'standard' ? 'ok' : 'warn'}">Mapping: ${pad.mapping || 'non-standard'}${pad.mapping === 'standard' ? '' : ' — buttons may not match the labels below'} · deadzone ${deadzone.toFixed(2)}</p><div class="sticks">${stick(lx, ly, 'Move (left stick)')}${stick(rx, ry, 'Tilt (right stick)')}</div><ul class="buttons">${buttons}</ul></article>`;
        })
        .join('');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return close;
}
