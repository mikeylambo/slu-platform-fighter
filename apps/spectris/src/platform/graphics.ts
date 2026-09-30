import { WebGLRenderer } from 'three';

export class GraphicsUnavailable extends Error {}

/** Retry a less demanding context on a fresh canvas if the preferred GPU path fails. */
export function createGraphicsRenderer(): WebGLRenderer {
 const attempts: WebGLContextAttributes[] = [
  { antialias: true, powerPreference: 'high-performance' },
  { antialias: false, powerPreference: 'default' },
 ];
 const failures: string[] = [];
 for (const attributes of attempts) {
  const canvas = document.createElement('canvas');
  let reason = '';
  canvas.addEventListener('webglcontextcreationerror', event => {
   reason = (event as WebGLContextEvent).statusMessage;
  });
  let context: WebGL2RenderingContext | null = null;
  try {
   context = canvas.getContext('webgl2', { ...attributes, alpha: false, depth: true, stencil: false });
  } catch (error) { reason = String(error); }
  if (context) return new WebGLRenderer({ canvas, context, ...attributes });
  failures.push(`${attributes.powerPreference}, antialias ${attributes.antialias}: ${reason || 'Browser returned no WebGL 2 context.'}`);
 }
 throw new GraphicsUnavailable(failures.join('\n'));
}

export function showStartupError(host: HTMLElement, error: unknown): void {
 const unavailable = error instanceof GraphicsUnavailable;
 host.innerHTML = `<section class="error" style="max-width:760px;margin:auto;padding:48px 24px"><div class="eyebrow">SPECTRIS DUELLUM</div><h1>${unavailable ? 'Graphics access is unavailable' : 'The game could not start'}</h1><p>${unavailable ? 'Your browser could not start the 3D renderer. Both graphics initialization attempts failed. This does not establish that your computer is incompatible.' : 'An unexpected startup error occurred. The details below can help identify the cause.'}</p>${unavailable ? '<ol><li>Check that graphics acceleration is enabled in your browser settings, then fully quit and reopen the browser.</li><li>If it still fails, try opening this page in another browser.</li></ol><p>In Chrome, open <code>chrome://gpu</code> and check Graphics Feature Status and Problems Detected.</p>' : ''}<button class="primary" id="retry-graphics">RETRY</button><details style="margin-top:24px"><summary>Technical details</summary><pre id="startup-details" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details></section>`;
 host.querySelector('#startup-details')!.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
 host.querySelector('#retry-graphics')!.addEventListener('click', () => location.reload());
}
