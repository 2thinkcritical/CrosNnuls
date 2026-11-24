import {
  BOARD_SIZE, CELL_SIZE, SCENE_HEIGHT, SCENE_WIDTH,
  boardMatrix, cellCenter, cubeTransform, projectPoint, rotatePoint,
} from './geometry.js';

const HALF = BOARD_SIZE / 2;
const MOVE_DURATION = 175;
const RESET_DURATION = 460;
const TAU = 2 * Math.PI;
const INK = { X: '#ff80ab', O: '#76e8ef' };

// Axes in the plane of each face, with brighter fills on the lit sides.
const FACES = [
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], fill: '#1d263e', board: true },
  { normal: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], fill: '#1a2337' },
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], fill: '#26334e' },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], fill: '#141d31' },
  { normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fill: '#141e34' },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fill: '#212b44' },
];

function facePoint(face, u, v) {
  return face.normal.map((normal, axis) => normal * HALF + face.u[axis] * u + face.v[axis] * v);
}

function drawPath(ctx, points, transform, closed = false) {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    const [x, y] = projectPoint(point, transform);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (closed) ctx.closePath();
}

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
    const ring = Array.from({ length: 36 }, (_, i) => {
      const angle = i * TAU / 36;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z];
    });
    drawPath(ctx, ring, transform, true);
  }
  ctx.stroke();
  ctx.restore();
}

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

export function createScene(canvas, grid, initialRound) {
  const ctx = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const markStarted = new Map();
  let round = initialRound;
  let resetStarted = null;
  let frame = null;

  function paint(time) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const [index, started] of markStarted) {
      if (time - started >= MOVE_DURATION) markStarted.delete(index);
    }
    if (resetStarted !== null && time - resetStarted >= RESET_DURATION) resetStarted = null;
    const rotating = resetStarted !== null;
    const resetProgress = rotating ? (time - resetStarted) / RESET_DURATION : 1;
    const progress = round.board.map((_, index) => markStarted.has(index)
      ? 1 - (1 - Math.max(0, time - markStarted.get(index)) / MOVE_DURATION) ** 3
      : 1);
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

export function drawStarfield(canvas) {
  const ctx = canvas.getContext('2d');
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
