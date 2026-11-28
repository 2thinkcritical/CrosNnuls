// Sound is opt-in. Each click uses a short, synthesized tone without loading a media file.
/**
 * @param {HTMLButtonElement} button the toggle that enables sound
 * @returns {{ click(): Promise<void> | void }}
 */
export function createSound(button) {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) {
    button.hidden = true;
    return { click() {} };
  }

  /** @type {AudioContext | undefined} */
  let context;
  let enabled = false;

  async function click() {
    if (!enabled) return;
    try {
      const audio = (context ??= new Context());
      if (audio.state !== 'running') await audio.resume();
      if (!enabled) return;

      const tone = audio.createOscillator();
      const volume = audio.createGain();
      const now = audio.currentTime;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(480, now);
      tone.frequency.exponentialRampToValueAtTime(210, now + 0.075);
      volume.gain.setValueAtTime(0.06, now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      tone.connect(volume).connect(audio.destination);
      tone.start(now);
      tone.stop(now + 0.10);
    } catch {
      enabled = false;
      button.setAttribute('aria-pressed', 'false');
    }
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    void click();
  });
  return { click };
}
