export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function readSetting(key: string, fallback: string) {
  try {
    return localStorage.getItem(`spectris:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(`spectris:${key}`, value);
  } catch {
    /* The game remains playable without persistent storage. */
  }
}
