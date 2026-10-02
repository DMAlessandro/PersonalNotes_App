// The device name shown in the Change log and commit messages (spec §5.7). Settings will let the user
// set it (slice 4); until then it is guessed from the screen: touch-first = "Phone", otherwise "Laptop".
const KEY = 'pn.deviceName';

export function deviceName(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    // storage blocked: fall through to the guess
  }
  return window.matchMedia('(pointer: coarse)').matches ? 'Phone' : 'Laptop';
}

export function setDeviceName(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // ignore: the guess is used instead
  }
}
