// A procedurally painted night sky: Milky Way, crescent moon, clouds and a grass horizon.
// Everything is generated from a fixed seed, so the scene is identical on every visit
// and needs no image files. Twinkling and shooting stars respect reduced motion.

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

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} color CSS colour with alpha
 */
function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/**
 * Paints everything that does not move.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function paintStatic(ctx, width, height) {
  const next = random(SEED);
  const horizon = height * 0.8;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#060a1d');
  sky.addColorStop(0.45, '#0f1a45');
  sky.addColorStop(0.75, '#1c3a72');
  sky.addColorStop(1, '#0b1230');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // The Milky Way: soft teal and violet clouds along a diagonal band.
  const band = (/** @type {number} */ t) => [t * width, height * 0.72 - t * height * 0.62];
  for (let i = 0; i < 70; i++) {
    const t = next();
    const [x, y] = band(t);
    const spread = (next() - 0.5) * Math.min(width, height) * 0.22;
    const color = next() < 0.55 ? 'rgba(64, 170, 205, 0.12)' : 'rgba(150, 100, 230, 0.12)';
    glow(ctx, x + spread * 0.6, y + spread, Math.min(width, height) * (0.08 + next() * 0.16), color);
  }

  // Background stars, denser inside the band.
  const stars = Math.round((width * height) / 1400);
  for (let i = 0; i < stars; i++) {
    let x = next() * width;
    let y = next() * horizon;
    if (next() < 0.45) {
      const t = next();
      [x, y] = band(t);
      x += (next() - 0.5) * width * 0.18;
      y += (next() - 0.5) * height * 0.2;
    }
    const size = 0.3 + next() ** 6 * 1.6;
    const tint = next();
    const alpha = 0.35 + next() * 0.6;
    ctx.fillStyle = tint < 0.12 ? `rgba(150, 235, 255, ${alpha})`
      : tint < 0.2 ? `rgba(255, 170, 220, ${alpha})`
        : `rgba(225, 232, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }

  // On narrow or short screens the title covers the left of the sky, so the moon moves to the top corner.
  const narrow = width < 700 || height < 520;
  paintMoon(ctx, width * (narrow ? 0.13 : 0.17), height * (narrow ? 0.055 : 0.2), Math.max(20, Math.min(width, height) * 0.045));

  // Low clouds glowing above the horizon.
  for (let i = 0; i < 26; i++) {
    const x = next() * width;
    const y = horizon - height * (0.02 + next() * 0.09);
    glow(ctx, x, y, width * (0.06 + next() * 0.1), 'rgba(150, 200, 255, 0.11)');
  }

  paintGrass(ctx, width, height, horizon, next);

  // A stargazer sitting on the hill, off to the side so the game stays clear.
  if (!narrow) {
    const x = width * 0.8;
    const size = Math.min(height * 0.17, 160);
    paintStargazer(ctx, x, groundAt(x, width, height, horizon) + size * 0.02, size);
    paintBlades(ctx, x - size * 0.5, x + size * 0.5, width, height, horizon, next, Math.round(size / 4));
  }
}

/**
 * Height of the rolling hill at ``x``.
 * @param {number} x
 * @param {number} width
 * @param {number} height
 * @param {number} horizon
 */
function groundAt(x, width, height, horizon) {
  return horizon + Math.sin(x / width * 5.2) * height * 0.012 + height * 0.02;
}

/**
 * A figure seen from behind, sitting on the hill and looking up at the sky.
 * Moonlight from the upper left catches the left edge of the silhouette.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x centre of the figure
 * @param {number} ground y of the hill under the figure
 * @param {number} s figure height in pixels
 */
function paintStargazer(ctx, x, ground, s) {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(s, s);
  glow(ctx, 0, -0.45, 1.1, 'rgba(150, 170, 255, 0.16)');

  const outline = new Path2D();
  // Torso, shoulders and neck.
  outline.moveTo(-0.3, 0);
  {
    const path = outline;
    path.bezierCurveTo(-0.31, -0.12, -0.22, -0.2, -0.18, -0.3);
    path.bezierCurveTo(-0.17, -0.4, -0.25, -0.46, -0.24, -0.53);
    path.bezierCurveTo(-0.23, -0.59, -0.15, -0.61, -0.07, -0.63);
    path.lineTo(-0.055, -0.7);
    path.lineTo(0.055, -0.7);
    path.lineTo(0.07, -0.63);
    path.bezierCurveTo(0.15, -0.61, 0.23, -0.59, 0.24, -0.53);
    path.bezierCurveTo(0.25, -0.46, 0.17, -0.4, 0.18, -0.3);
    path.bezierCurveTo(0.22, -0.2, 0.31, -0.12, 0.3, 0);
    path.closePath();
  }
  // Head, tilted slightly back toward the sky.
  outline.ellipse(0, -0.8, 0.105, 0.12, -0.12, 0, Math.PI * 2);
  // Arms resting on the knees in front, visible as bulges at the sides.
  outline.ellipse(-0.27, -0.27, 0.07, 0.2, 0.25, 0, Math.PI * 2);
  outline.ellipse(0.27, -0.27, 0.07, 0.2, -0.25, 0, Math.PI * 2);

  // Long hair falling over the back, ending in loose strands.
  const hair = new Path2D();
  hair.moveTo(-0.1, -0.86);
  hair.bezierCurveTo(-0.17, -0.72, -0.15, -0.56, -0.13, -0.4);
  hair.lineTo(-0.09, -0.36);
  hair.lineTo(-0.05, -0.41);
  hair.lineTo(-0.01, -0.35);
  hair.lineTo(0.04, -0.41);
  hair.lineTo(0.08, -0.36);
  hair.lineTo(0.12, -0.42);
  hair.bezierCurveTo(0.15, -0.56, 0.16, -0.72, 0.1, -0.86);
  hair.closePath();

  ctx.fillStyle = '#070a1d';
  ctx.fill(outline);
  ctx.fillStyle = '#0b0f28';
  ctx.fill(hair);

  // Rim light along the moonlit edge.
  ctx.strokeStyle = 'rgba(206, 190, 255, 0.8)';
  ctx.lineWidth = 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, -0.8, 0.105, 0.12, -0.12, Math.PI * 1.02, Math.PI * 1.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.86);
  ctx.bezierCurveTo(-0.17, -0.72, -0.15, -0.56, -0.13, -0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.61);
  ctx.bezierCurveTo(-0.22, -0.59, -0.25, -0.54, -0.3, -0.45);
  ctx.stroke();
  ctx.restore();
}

/**
 * Grass blades between ``from`` and ``to``, drawn in front of the figure.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} from
 * @param {number} to
 * @param {number} width
 * @param {number} height
 * @param {number} horizon
 * @param {() => number} next
 * @param {number} count
 */
function paintBlades(ctx, from, to, width, height, horizon, next, count) {
  ctx.strokeStyle = '#0a1029';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = from + next() * (to - from);
    const base = groundAt(x, width, height, horizon) + height * 0.006;
    const tall = height * (0.008 + next() ** 2 * 0.03);
    const lean = (next() - 0.35) * tall * 0.8;
    ctx.lineWidth = 0.8 + next() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.3, base - tall * 0.6, x + lean, base - tall);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 */
function paintMoon(ctx, x, y, radius) {
  glow(ctx, x, y, radius * 4, 'rgba(255, 140, 210, 0.22)');
  const moon = document.createElement('canvas');
  const size = Math.ceil(radius * 2.4);
  moon.width = moon.height = size;
  const m = context2d(moon);
  const c = size / 2;
  const fill = m.createRadialGradient(c - radius * 0.3, c - radius * 0.3, radius * 0.2, c, c, radius);
  fill.addColorStop(0, '#ffd6f1');
  fill.addColorStop(1, '#e07fc4');
  m.fillStyle = fill;
  m.beginPath();
  m.arc(c, c, radius, 0, TAU);
  m.fill();
  // Cut the crescent with an offset disc.
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(c + radius * 0.42, c - radius * 0.2, radius * 0.86, 0, TAU);
  m.fill();
  ctx.drawImage(moon, x - c, y - c);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} horizon
 * @param {() => number} next
 */
function paintGrass(ctx, width, height, horizon, next) {
  const ground = ctx.createLinearGradient(0, horizon - 20, 0, height);
  ground.addColorStop(0, '#0d1433');
  ground.addColorStop(1, '#05081a');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 8) {
    ctx.lineTo(x, horizon + Math.sin(x / width * 5.2) * height * 0.012 + height * 0.02);
  }
  ctx.lineTo(width, height);
  ctx.fill();

  ctx.strokeStyle = '#0a1029';
  ctx.lineCap = 'round';
  const blades = Math.round(width / 3);
  for (let i = 0; i < blades; i++) {
    const x = next() * width;
    const base = horizon + Math.sin(x / width * 5.2) * height * 0.012 + height * 0.024;
    const tall = height * (0.012 + next() ** 2 * 0.05);
    const lean = (next() - 0.35) * tall * 0.8;
    ctx.lineWidth = 0.8 + next() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.3, base - tall * 0.6, x + lean, base - tall);
    ctx.stroke();
  }
}

/**
 * Draws the sky into ``canvas`` and keeps it sized to the viewport.
 * @param {HTMLCanvasElement} canvas
 */
export function createSky(canvas) {
  const ctx = context2d(canvas);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const backdrop = document.createElement('canvas');
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
    for (const target of [canvas, backdrop]) {
      target.width = Math.round(width * ratio);
      target.height = Math.round(height * ratio);
    }
    const back = context2d(backdrop);
    back.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintStatic(back, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const next = random(SEED + 1);
    twinkles = Array.from({ length: 70 }, () => ({
      x: next() * width,
      y: next() * height * 0.75,
      r: 0.8 + next() * 1.2,
      phase: next() * TAU,
      speed: 0.6 + next() * 1.6,
    }));
    draw(performance.now());
  }

  /** @param {number} time */
  function draw(time) {
    frame = null;
    const ratio = canvas.width / width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const still = motion.matches;

    for (const star of twinkles) {
      const light = still ? 0.8 : 0.45 + 0.55 * Math.sin(star.phase + (time / 1000) * star.speed) ** 2;
      glow(ctx, star.x, star.y, star.r * 5, `rgba(200, 235, 255, ${0.25 * light})`);
      ctx.fillStyle = `rgba(240, 248, 255, ${light})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }

    if (!still) {
      if (!meteor && time > nextMeteor) {
        meteor = { x: width * (0.45 + Math.random() * 0.45), y: height * (0.05 + Math.random() * 0.25),
          dx: -width * 0.32, dy: height * 0.16, born: time };
      }
      if (meteor) {
        const age = (time - meteor.born) / 1100;
        if (age >= 1) {
          meteor = null;
          nextMeteor = time + 3500 + Math.random() * 5000;
        } else {
          const head = [meteor.x + meteor.dx * age, meteor.y + meteor.dy * age];
          const tail = [head[0] - meteor.dx * 0.25, head[1] - meteor.dy * 0.25];
          const trail = ctx.createLinearGradient(tail[0], tail[1], head[0], head[1]);
          trail.addColorStop(0, 'rgba(140, 230, 255, 0)');
          trail.addColorStop(1, `rgba(200, 245, 255, ${0.9 * Math.sin(age * Math.PI)})`);
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
  }

  motion.addEventListener('change', () => {
    if (frame !== null) cancelAnimationFrame(frame);
    draw(performance.now());
  });
  new ResizeObserver(resize).observe(canvas);
  nextMeteor = performance.now() + 1500;
  resize();
}
