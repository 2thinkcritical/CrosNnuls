// Sound is opt-in: one toggle starts the background music and enables a short,
// synthesized click on each move. Nothing is downloaded until sound is turned on.
// Volume goes through a Web Audio gain node, because iOS ignores element volume.

const MUSIC_URL = 'music.m4a';
const MUSIC_VOLUME = 0.35;
const FADE_SECONDS = 0.6;

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

  /** @type {{ context: AudioContext, music: HTMLAudioElement, gain: GainNode } | undefined} */
  let graph;
  let enabled = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pauseTimer;

  /** Builds the audio graph on first use, inside the user's click. */
  function audioGraph() {
    if (!graph) {
      const context = new Context();
      const music = Object.assign(new Audio(MUSIC_URL), { loop: true });
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(music).connect(gain).connect(context.destination);
      graph = { context, music, gain };
    }
    return graph;
  }

  /**
   * @param {GainNode} gain
   * @param {number} to
   */
  function fade(gain, to) {
    const now = gain.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + FADE_SECONDS);
  }

  async function click() {
    if (!enabled || !graph) return;
    const { context } = graph;
    try {
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
      // A missing audio device must not break the game.
    }
  }

  async function turnOn() {
    const { context, music, gain } = audioGraph();
    clearTimeout(pauseTimer);
    try {
      if (context.state !== 'running') await context.resume();
      await music.play();
      if (enabled) fade(gain, MUSIC_VOLUME);
    } catch {
      // Playback can be refused (no audio device, blocked by the browser).
    }
    void click();
  }

  function turnOff() {
    if (!graph) return;
    const { music, gain } = graph;
    fade(gain, 0);
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => { if (!enabled) music.pause(); }, FADE_SECONDS * 1000);
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    if (enabled) void turnOn();
    else turnOff();
  });
  return { click };
}
