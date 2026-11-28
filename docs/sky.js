// Animated layer over the background illustration: a few twinkling stars and an
// occasional shooting star. Nothing moves when the user prefers reduced motion.

const TAU = Math.PI * 2;
const SEED = 20251215;

/** @param {number} seed */
function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
function context2d(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  return ctx;
}

/** @param {HTMLCanvasElement} canvas a full-screen, transparent canvas */
export function createSky(canvas) {
  const ctx = context2d(canvas);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** @type {{ x: number, y: number, r: number, phase: number, speed: number }[]} */
  let twinkles = [];
  /** @type {{ x: number, y: number, dx: number, dy: number, born: number } | null} */
  let meteor = null;
  let nextMeteor = 0;
  let width = 0;
  let height = 0;
  /** @type {number | null} */
  let frame = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const next = random(SEED);
    twinkles = Array.from({ length: 45 }, () => ({
      x: next() * width,
      y: next() * height * 0.65,
      r: 0.7 + next() * 1.1,
      phase: next() * TAU,
      speed: 0.5 + next() * 1.5,
    }));
    if (frame === null) draw(performance.now());
  }

  /** @param {number} time */
  function draw(time) {
    frame = null;
    ctx.clearRect(0, 0, width, height);
    if (motion.matches) return;

    for (const star of twinkles) {
      const light = Math.sin(star.phase + (time / 1000) * star.speed) ** 2;
      const halo = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 6);
      halo.addColorStop(0, `rgba(210, 240, 255, ${0.35 * light})`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(star.x - star.r * 6, star.y - star.r * 6, star.r * 12, star.r * 12);
      ctx.fillStyle = `rgba(245, 250, 255, ${light})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }

    if (!meteor && time > nextMeteor) {
      meteor = {
        x: width * (0.45 + Math.random() * 0.45), y: height * (0.05 + Math.random() * 0.25),
        dx: -width * 0.32, dy: height * 0.16, born: time,
      };
    }
    if (meteor) {
      const age = (time - meteor.born) / 1100;
      if (age >= 1) {
        meteor = null;
        nextMeteor = time + 4000 + Math.random() * 6000;
      } else {
        const head = [meteor.x + meteor.dx * age, meteor.y + meteor.dy * age];
        const tail = [head[0] - meteor.dx * 0.25, head[1] - meteor.dy * 0.25];
        const trail = ctx.createLinearGradient(tail[0], tail[1], head[0], head[1]);
        trail.addColorStop(0, 'rgba(140, 230, 255, 0)');
        trail.addColorStop(1, `rgba(210, 248, 255, ${0.9 * Math.sin(age * Math.PI)})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tail[0], tail[1]);
        ctx.lineTo(head[0], head[1]);
        ctx.stroke();
      }
    }
    frame = requestAnimationFrame(draw);
  }

  motion.addEventListener('change', () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    draw(performance.now());
  });
  new ResizeObserver(resize).observe(canvas);
  nextMeteor = performance.now() + 2500;
  resize();
}
