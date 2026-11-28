import {
  BOARD_SIZE, CELL_SIZE, SCENE_HEIGHT, SCENE_WIDTH,
  boardMatrix, cellCenter, cubeTransform, projectPoint, rotatePoint,
} from './geometry.js';

/** @typedef {import('./geometry.js').Vec3} Vec3 */
/** @typedef {import('./geometry.js').Transform} Transform */
/** @typedef {import('./rules.js').Mark} Mark */
/** @typedef {import('./rules.js').Round} Round */
/** @typedef {{ normal: Vec3, u: Vec3, v: Vec3, fill: string, board?: boolean }} Face */

const HALF = BOARD_SIZE / 2;
const MOVE_DURATION = 175;
const RESET_DURATION = 460;
const TAU = 2 * Math.PI;
/** @type {Record<Mark, string>} */
const INK = { X: '#ff80ab', O: '#76e8ef' };

// Axes in the plane of each face, with brighter fills on the lit sides.
/** @type {Face[]} */
const FACES = [
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], fill: '#1d263e', board: true },
  { normal: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], fill: '#1a2337' },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], fill: '#26334e' },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], fill: '#141d31' },
  { normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fill: '#141e34' },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fill: '#212b44' },
];

/**
 * @param {Face} face
 * @param {number} u offset along the face's first axis
 * @param {number} v offset along the face's second axis
 * @returns {Vec3}
 */
function facePoint(face, u, v) {
  const [x, y, z] = face.normal.map((normal, axis) => normal * HALF + face.u[axis] * u + face.v[axis] * v);
  return [x, y, z];
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Vec3[]} points
 * @param {Transform} transform
 * @param {boolean} [closed]
 */
function drawPath(ctx, points, transform, closed = false) {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    const [x, y] = projectPoint(point, transform);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (closed) ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Face} face
 * @param {Transform} transform
 */
function drawFace(ctx, face, transform) {
  drawPath(ctx, [
    facePoint(face, -HALF, -HALF), facePoint(face, -HALF, HALF),
    facePoint(face, HALF, HALF), facePoint(face, HALF, -HALF),
  ], transform, true);

  ctx.fillStyle = face.fill;
  ctx.fill();
  ctx.strokeStyle = face.board ? '#8c9dbc' : '#506682';
  ctx.lineWidth = face.board ? 1.6 : 1;
  ctx.stroke();

  ctx.strokeStyle = face.board ? '#64789f' : '#394b6b';
  ctx.lineWidth = face.board ? 1.3 : 1;
  for (const inset of [-CELL_SIZE / 2, CELL_SIZE / 2]) {
    drawPath(ctx, [facePoint(face, inset, -HALF), facePoint(face, inset, HALF)], transform);
    ctx.stroke();
    drawPath(ctx, [facePoint(face, -HALF, inset), facePoint(face, HALF, inset)], transform);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} index
 * @param {Mark} mark
 * @param {number} progress animation progress, 0-1
 * @param {Transform} transform
 */
function drawMark(ctx, index, mark, progress, transform) {
  const [x, y, z] = cellCenter(index);
  const radius = CELL_SIZE * 0.27 * progress;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 15;
  ctx.shadowColor = INK[mark];
  ctx.strokeStyle = INK[mark];

  if (mark === 'X') {
    drawPath(ctx, [[x - radius, y + radius, z], [x + radius, y - radius, z]], transform);
    ctx.stroke();
    drawPath(ctx, [[x + radius, y + radius, z], [x - radius, y - radius, z]], transform);
  } else {
    /** @type {Vec3[]} */
    const ring = Array.from({ length: 36 }, (_, i) => {
      const angle = i * TAU / 36;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z];
    });
    drawPath(ctx, ring, transform, true);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} line
 * @param {Transform} transform
 */
function drawWinningLine(ctx, line, transform) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#a2ffca';
  ctx.strokeStyle = '#baffd6';
  drawPath(ctx, [cellCenter(line[0]), cellCenter(line[2])], transform);
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Round} round
 * @param {number} rotation
 * @param {number[]} progress per-cell animation progress
 */
function drawCube(ctx, round, rotation, progress) {
  ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  const transform = cubeTransform(rotation);
  const visibleFaces = FACES.map(face => ({
    face, depth: rotatePoint(face.normal, transform)[2],
  })).filter(({ depth }) => depth > 0).sort((a, b) => a.depth - b.depth);

  for (const { face } of visibleFaces) {
    drawFace(ctx, face, transform);
    if (!face.board) continue;
    for (const [index, mark] of round.board.entries()) {
      if (mark) drawMark(ctx, index, mark, progress[index], transform);
    }
    if (round.outcome?.winningLine && progress.every(value => value === 1)) {
      drawWinningLine(ctx, round.outcome.winningLine, transform);
    }
  }
}

/**
 * Sizes the backing store for the device pixel ratio and scales drawing to logical units.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} logicalWidth
 * @param {number} logicalHeight
 */
function resizeCanvas(canvas, ctx, logicalWidth, logicalHeight) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const pixelsWide = Math.max(1, Math.round(width * ratio));
  const pixelsHigh = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
  if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
  ctx.setTransform(pixelsWide / logicalWidth, 0, 0, pixelsHigh / logicalHeight, 0, 0);
  return { width, height };
}

/** @param {HTMLCanvasElement} canvas */
function context2d(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  return ctx;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} grid the HTML button grid kept aligned with the front face
 * @param {Round} initialRound
 */
export function createScene(canvas, grid, initialRound) {
  const ctx = context2d(canvas);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** @type {Map<number, number>} */
  const markStarted = new Map();
  let round = initialRound;
  /** @type {number | null} */
  let resetStarted = null;
  /** @type {number | null} */
  let frame = null;

  /** @param {number} time */
  function paint(time) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const [index, started] of markStarted) {
      if (time - started >= MOVE_DURATION) markStarted.delete(index);
    }
    if (resetStarted !== null && time - resetStarted >= RESET_DURATION) resetStarted = null;
    const rotating = resetStarted !== null;
    const resetProgress = resetStarted === null ? 1 : (time - resetStarted) / RESET_DURATION;
    const progress = round.board.map((_, index) => {
      const started = markStarted.get(index);
      return started === undefined ? 1 : 1 - (1 - Math.max(0, time - started) / MOVE_DURATION) ** 3;
    });
    drawCube(ctx, round, TAU * (1 - (1 - Math.max(0, resetProgress)) ** 3), progress);
    grid.classList.toggle('rotating', rotating);
    if (rotating || markStarted.size) frame = requestAnimationFrame(paint);
  }

  function resize() {
    const { width, height } = resizeCanvas(canvas, ctx, SCENE_WIDTH, SCENE_HEIGHT);
    grid.style.transform = `matrix(${boardMatrix(width, height).join(', ')})`;
    paint(performance.now());
  }

  motion.addEventListener('change', () => {
    markStarted.clear();
    resetStarted = null;
    paint(performance.now());
  });
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  return {
    /**
     * @param {Round} next
     * @param {{ reset?: boolean, rotate?: boolean }} [options]
     */
    show(next, { reset = false, rotate = false } = {}) {
      const now = performance.now();
      resetStarted = rotate && !motion.matches ? now : null;
      if (reset) markStarted.clear();
      else if (!motion.matches) {
        next.board.forEach((mark, index) => {
          if (mark && !round.board[index]) markStarted.set(index, now);
        });
      }
      round = next;
      paint(now);
    },
  };
}

/** @param {HTMLCanvasElement} canvas */
export function drawStarfield(canvas) {
  const ctx = context2d(canvas);
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    resizeCanvas(canvas, ctx, width, height);
    ctx.clearRect(0, 0, width, height);

    // The seed keeps the original starfield stable when the window is resized.
    let seed = 59021;
    function next() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    }
    const stars = Math.min(570, Math.round(width * height / 2000));
    for (let index = 0; index < stars; index++) {
      const [x, y, brightness] = [next() * width, next() * height, next()];
      const radius = 0.35 + brightness ** 5 * 1.1;
      ctx.fillStyle = `rgba(201, 220, 255, ${0.12 + brightness * 0.48})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
}
