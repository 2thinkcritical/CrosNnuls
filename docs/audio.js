// Sound is opt-in. Each click uses a short, synthesized tone without loading a media file.
export function createSound(button) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    button.hidden = true;
    return { click() {} };
  }

  let context;
  let enabled = false;

  async function click() {
    if (!enabled) return;
    try {
      context ??= new AudioContext();
      if (context.state !== 'running') await context.resume();
      if (!enabled) return;

      const tone = context.createOscillator();
      const volume = context.createGain();
      const now = context.currentTime;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(480, now);
      tone.frequency.exponentialRampToValueAtTime(210, now + 0.075);
      volume.gain.setValueAtTime(0.06, now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      tone.connect(volume).connect(context.destination);
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
