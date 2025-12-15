/**
 * Крестики-нолики — Веб-версия
 * 3D куб с игровым полем на передней грани
 */

// ══════════════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ══════════════════════════════════════════════════════════════════

const CONFIG = {
  // Cloudflare Worker URL (замените на ваш после деплоя)
  // Пример: 'https://tictactoe-telegram.your-subdomain.workers.dev'
  // Для локального тестирования: 'http://localhost:8081'
  WORKER_URL: 'https://soft-field-1574.2thinkcritical.workers.dev',
  BOT_USERNAME: 'promo_for_user_bot',  // Username бота без @

  // Размеры
  CUBE_SIZE: 300,
  CELL_SIZE: 100,
  LINE_WIDTH: 5,
  SYMBOL_PADDING: 22,

  // Анимация
  ANIM_STEPS: 16,
  ANIM_DELAY: 12,
  FLIP_STEPS: 30,
  FLIP_DELAY: 16,
};

// Выигрышные линии
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // горизонтальные
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // вертикальные
  [0, 4, 8], [2, 4, 6],             // диагонали
];

// ══════════════════════════════════════════════════════════════════
// ЦВЕТОВАЯ ПАЛИТРА
// ══════════════════════════════════════════════════════════════════

const COLORS = {
  bgMain: '#0B0E17',
  bgGradientTop: '#0F1423',
  bgGradientBottom: '#1A1E2E',

  cubeTop: '#1E2438',
  cubeRight: '#151929',
  cubeLeft: '#1A1F32',

  bgCell: '#232940',
  bgCellHover: '#2E3650',
  gridLine: '#3D4565',
  borderAccent: '#6B7AAA',

  xColor: '#FF6B9D',
  xGlow: '#FF8FB3',
  oColor: '#00D4FF',
  oGlow: '#66E5FF',

  textPrimary: '#E8ECF5',
  textSecondary: '#B8C0D8',
  textMuted: '#7A85A8',

  winColor: '#00E5A0',
  winGlow: '#66F5C8',
  lossColor: '#FF6B6B',
  drawColor: '#FFD166',

  accent: '#7B68EE',
  accentHover: '#9580FF',
  moonPink: '#E8A4C9',
  moonPinkHover: '#F0B8D8',
};

// ══════════════════════════════════════════════════════════════════
// СОСТОЯНИЕ ИГРЫ
// ══════════════════════════════════════════════════════════════════

const state = {
  board: Array(9).fill(''),
  gameOver: false,
  hoverCell: null,
  promoCode: null,
  telegramChatId: null,
  gameBlocked: true,
  computerThinking: false,

  // Анимация
  flipAngle: 0,
  isFlipping: false,
  flipDirection: 1,
  gameNumber: 0,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
  isShaking: false,

  // Анимация символов
  symbolAnimations: {},

  // Связь с Telegram по session-id
  telegramSessionId: null,
};

// ══════════════════════════════════════════════════════════════════
// DOM ЭЛЕМЕНТЫ
// ══════════════════════════════════════════════════════════════════

let bgCanvas, bgCtx;
let gameCanvas, gameCtx;
let statusText, gameBtn;
let usernameDialog, usernameBtn;
let backgroundImage = null;

// ══════════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Получаем элементы
  bgCanvas = document.getElementById('bg-canvas');
  bgCtx = bgCanvas.getContext('2d');
  gameCanvas = document.getElementById('game-canvas');
  gameCtx = gameCanvas.getContext('2d');

  statusText = document.getElementById('status-text');
  gameBtn = document.getElementById('game-btn');

  usernameDialog = document.getElementById('username-dialog');
  usernameBtn = document.getElementById('username-btn');

  // Загружаем фон
  loadBackground();

  // Настраиваем размеры
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  // События игрового поля
  gameCanvas.addEventListener('mousemove', onMouseMove);
  gameCanvas.addEventListener('mouseleave', onMouseLeave);
  gameCanvas.addEventListener('click', onClick);

  // Кнопки
  gameBtn.addEventListener('click', onGameBtnClick);
  usernameBtn.addEventListener('click', onUsernameSubmit);

  // Показываем диалог старта
  setTimeout(() => {
    usernameDialog.classList.add('visible');
    usernameBtn.focus();
  }, 300);

  // Музыка
  initMusic();

  // Начальная отрисовка
  drawCube();
  updateStatus('');
});

// ══════════════════════════════════════════════════════════════════
// МУЗЫКА
// ══════════════════════════════════════════════════════════════════

let musicPlaying = false;
let musicInitialized = false;
let bgAudio = null;
let clickAudio = null;

function initMusic() {
  // Создаем аудио объекты
  bgAudio = new Audio('music.mp3');
  bgAudio.loop = true;
  bgAudio.volume = 0.5;

  clickAudio = new Audio('click.wav');
  clickAudio.volume = 0.4;

  const btn = document.getElementById('music-btn');

  btn.addEventListener('click', () => {
    playClickSound();
    if (!bgAudio) return;

    if (bgAudio.paused) {
      bgAudio.play().then(() => {
        musicPlaying = true;
        updateMusicBtn();
      }).catch(e => {
        console.error('Manual play failed:', e);
        alert(`Не удалось запустить музыку: ${e.message || 'Неизвестная ошибка'}`);
      });
    } else {
      bgAudio.pause();
      musicPlaying = false;
      updateMusicBtn();
    }
    musicInitialized = true;
  });

  // Пытаемся запустить музыку при первом клике по странице
  document.body.addEventListener('click', () => {
    startMusic();
  }, { once: true });
}

function playClickSound() {
  if (clickAudio) {
    clickAudio.currentTime = 0;
    clickAudio.play().catch(e => console.warn('Click sound failed:', e));
  }
}

function startMusic() {
  if (!bgAudio || musicInitialized || !bgAudio.paused) return;

  console.log('Attempting to start music via JS...');

  const playPromise = bgAudio.play();

  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('Music started successfully!');
      musicPlaying = true;
      musicInitialized = true;
      updateMusicBtn();
    }).catch((e) => {
      console.warn('Autoplay failed:', e);
      const btn = document.getElementById('music-btn');
      btn.style.borderColor = '#FF6B6B';
      btn.style.animation = 'pulse 1s infinite';
    });
  }
}

function updateMusicBtn() {
  const btn = document.getElementById('music-btn');
  // Убираем индикацию ошибки если была
  btn.style.borderColor = '';
  btn.style.animation = '';

  if (musicPlaying) {
    btn.classList.add('playing');
    btn.textContent = '🔊';
  } else {
    btn.classList.remove('playing');
    btn.textContent = '🔇';
  }
}

function loadBackground() {
  backgroundImage = new Image();
  backgroundImage.onload = () => {
    drawBackground();
  };
  backgroundImage.src = 'background.jpg';
}

function resizeCanvases() {
  // Фон на всё окно
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  drawBackground();
}

// ══════════════════════════════════════════════════════════════════
// ФОНОВЫЙ CANVAS
// ══════════════════════════════════════════════════════════════════

function drawBackground() {
  const w = bgCanvas.width;
  const h = bgCanvas.height;

  // Заливаем фон тёмным цветом
  bgCtx.fillStyle = COLORS.bgMain;
  bgCtx.fillRect(0, 0, w, h);

  // Фоновое изображение (если загружено)
  if (backgroundImage && backgroundImage.complete) {
    const imgW = backgroundImage.width;
    const imgH = backgroundImage.height;
    const imgRatio = imgW / imgH;
    const canvasRatio = w / h;

    let drawW, drawH, drawX, drawY;

    // Contain: вся картинка видна, сохраняя пропорции
    if (canvasRatio > imgRatio) {
      // Canvas шире - масштабируем по высоте
      drawH = h;
      drawW = h * imgRatio;
      drawX = (w - drawW) / 2;
      drawY = 0;
    } else {
      // Canvas выше - масштабируем по ширине
      drawW = w;
      drawH = w / imgRatio;
      drawX = 0;
      drawY = (h - drawH) / 2;
    }

    bgCtx.drawImage(backgroundImage, drawX, drawY, drawW, drawH);
  }
}

// ══════════════════════════════════════════════════════════════════
// 3D ТРАНСФОРМАЦИИ
// ══════════════════════════════════════════════════════════════════

function getCubeTransform(angle = 0) {
  const cx = gameCanvas.width / 2 + state.shakeOffsetX;
  const cy = gameCanvas.height / 2 + state.shakeOffsetY - 20;
  const size = CONFIG.CUBE_SIZE;

  const flipRad = angle * Math.PI / 180;
  const tiltX = 15 * Math.PI / 180;  // наклон назад
  const tiltY = -20 * Math.PI / 180; // поворот влево

  return { cx, cy, size, tiltX, tiltY, flipAngle: flipRad };
}

function projectPoint(x, y, z, transform) {
  const { cx, cy, tiltX, tiltY, flipAngle } = transform;

  // Поворот вокруг оси Y (переворот куба)
  let xRot = x * Math.cos(flipAngle) + z * Math.sin(flipAngle);
  let zRot = -x * Math.sin(flipAngle) + z * Math.cos(flipAngle);
  x = xRot;
  z = zRot;

  // Наклон вокруг оси Y
  xRot = x * Math.cos(tiltY) + z * Math.sin(tiltY);
  zRot = -x * Math.sin(tiltY) + z * Math.cos(tiltY);
  x = xRot;
  z = zRot;

  // Наклон вокруг оси X
  const yRot = y * Math.cos(tiltX) - z * Math.sin(tiltX);
  zRot = y * Math.sin(tiltX) + z * Math.cos(tiltX);
  y = yRot;
  z = zRot;

  // Проекция
  const scale = 0.9;
  const px = cx + x * scale;
  const py = cy - y * scale;

  return [px, py];
}

function transformNormal(nx, ny, nz, transform) {
  const { tiltX, tiltY, flipAngle } = transform;

  // Поворот вокруг Y
  let nxRot = nx * Math.cos(flipAngle) + nz * Math.sin(flipAngle);
  let nzRot = -nx * Math.sin(flipAngle) + nz * Math.cos(flipAngle);
  nx = nxRot;
  nz = nzRot;

  // Наклон Y
  nxRot = nx * Math.cos(tiltY) + nz * Math.sin(tiltY);
  nzRot = -nx * Math.sin(tiltY) + nz * Math.cos(tiltY);
  nx = nxRot;
  nz = nzRot;

  // Наклон X
  const nyRot = ny * Math.cos(tiltX) - nz * Math.sin(tiltX);
  nzRot = ny * Math.sin(tiltX) + nz * Math.cos(tiltX);
  ny = nyRot;
  nz = nzRot;

  return [nx, ny, nz];
}

function getFaceDepth(cx, cy, cz, transform) {
  const { tiltX, tiltY, flipAngle } = transform;

  // Поворот Y
  let xRot = cx * Math.cos(flipAngle) + cz * Math.sin(flipAngle);
  let zRot = -cx * Math.sin(flipAngle) + cz * Math.cos(flipAngle);
  cx = xRot;
  cz = zRot;

  // Наклон Y
  xRot = cx * Math.cos(tiltY) + cz * Math.sin(tiltY);
  zRot = -cx * Math.sin(tiltY) + cz * Math.cos(tiltY);
  cz = zRot;

  // Наклон X
  zRot = cy * Math.sin(tiltX) + cz * Math.cos(tiltX);

  return zRot;
}

// ══════════════════════════════════════════════════════════════════
// ОТРИСОВКА 3D КУБА
// ══════════════════════════════════════════════════════════════════

function drawCube() {
  const ctx = gameCtx;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  const transform = getCubeTransform(state.flipAngle);
  const size = transform.size;
  const half = size / 2;

  // Вершины куба
  const vertices3D = [
    [-half, half, half],    // 0: перед-верх-лево
    [half, half, half],     // 1: перед-верх-право
    [half, -half, half],    // 2: перед-низ-право
    [-half, -half, half],   // 3: перед-низ-лево
    [-half, half, -half],   // 4: зад-верх-лево
    [half, half, -half],    // 5: зад-верх-право
    [half, -half, -half],   // 6: зад-низ-право
    [-half, -half, -half],  // 7: зад-низ-лево
  ];

  // Проецируем вершины
  const vertices2D = vertices3D.map(v => projectPoint(v[0], v[1], v[2], transform));

  // Грани куба
  const faces = [
    { indices: [0, 1, 2, 3], normal: [0, 0, 1], center: [0, 0, half], type: 'front' },
    { indices: [5, 4, 7, 6], normal: [0, 0, -1], center: [0, 0, -half], type: 'back' },
    { indices: [0, 1, 5, 4], normal: [0, 1, 0], center: [0, half, 0], type: 'top' },
    { indices: [3, 2, 6, 7], normal: [0, -1, 0], center: [0, -half, 0], type: 'bottom' },
    { indices: [1, 2, 6, 5], normal: [1, 0, 0], center: [half, 0, 0], type: 'right' },
    { indices: [0, 3, 7, 4], normal: [-1, 0, 0], center: [-half, 0, 0], type: 'left' },
  ];

  // Определяем видимые грани
  const visibleFaces = [];
  for (const face of faces) {
    const [nx, ny, nz] = transformNormal(face.normal[0], face.normal[1], face.normal[2], transform);
    if (nz > -0.01) {
      const depth = getFaceDepth(face.center[0], face.center[1], face.center[2], transform);
      visibleFaces.push({ face, depth });
    }
  }

  // Сортируем по глубине
  visibleFaces.sort((a, b) => a.depth - b.depth);

  // Рисуем грани
  for (const { face } of visibleFaces) {
    const points = face.indices.map(i => vertices2D[i]);

    switch (face.type) {
      case 'front':
        drawFace(ctx, points, COLORS.cubeTop);
        drawBoardOnFace(transform);
        break;
      case 'back':
        drawFace(ctx, points, COLORS.cubeTop, darkenColor(COLORS.cubeTop, 0.9));
        break;
      case 'top':
        drawFace(ctx, points, '#1A1F35', '#2A3555');
        drawGridOnFace(ctx, half, 'top', transform, '#3A4575');
        break;
      case 'bottom':
        drawFace(ctx, points, '#121728', '#222740');
        drawGridOnFace(ctx, half, 'bottom', transform, '#2A3050');
        break;
      case 'right':
        drawFace(ctx, points, '#151A2A', '#252A45');
        drawGridOnFace(ctx, half, 'right', transform, '#2A3055');
        break;
      case 'left':
        drawFace(ctx, points, '#181D30', '#282D48');
        drawGridOnFace(ctx, half, 'left', transform, '#303560');
        break;
    }
  }
}

function drawFace(ctx, points, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawGridOnFace(ctx, half, faceType, transform, color) {
  const size = half * 2;

  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    let p1, p2, p3, p4;

    switch (faceType) {
      case 'top':
        p1 = projectPoint(-half + t * size, half, half, transform);
        p2 = projectPoint(-half + t * size, half, -half, transform);
        p3 = projectPoint(-half, half, half - t * size, transform);
        p4 = projectPoint(half, half, half - t * size, transform);
        break;
      case 'bottom':
        p1 = projectPoint(-half + t * size, -half, half, transform);
        p2 = projectPoint(-half + t * size, -half, -half, transform);
        p3 = projectPoint(-half, -half, half - t * size, transform);
        p4 = projectPoint(half, -half, half - t * size, transform);
        break;
      case 'right':
        p1 = projectPoint(half, half - t * size, half, transform);
        p2 = projectPoint(half, half - t * size, -half, transform);
        p3 = projectPoint(half, half, half - t * size, transform);
        p4 = projectPoint(half, -half, half - t * size, transform);
        break;
      case 'left':
        p1 = projectPoint(-half, half - t * size, half, transform);
        p2 = projectPoint(-half, half - t * size, -half, transform);
        p3 = projectPoint(-half, half, half - t * size, transform);
        p4 = projectPoint(-half, -half, half - t * size, transform);
        break;
    }

    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.stroke();
  }
}

function drawBoardOnFace(transform) {
  const ctx = gameCtx;
  const size = transform.size;
  const half = size / 2;
  const cell = size / 3;
  const zFront = half;

  // Сетка
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 2;

  for (let i = 1; i < 3; i++) {
    // Вертикальные линии
    const xOffset = -half + i * cell;
    const p1 = projectPoint(xOffset, half, zFront, transform);
    const p2 = projectPoint(xOffset, -half, zFront, transform);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();

    // Горизонтальные линии
    const yOffset = -half + i * cell;
    const p3 = projectPoint(-half, yOffset, zFront, transform);
    const p4 = projectPoint(half, yOffset, zFront, transform);
    ctx.beginPath();
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.stroke();
  }

  // Символы
  for (let idx = 0; idx < 9; idx++) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;

    const cx3d = -half + col * cell + cell / 2;
    const cy3d = half - row * cell - cell / 2;
    const cz3d = zFront;

    // Hover подсветка
    if (state.hoverCell === idx && !state.board[idx] && !state.gameOver && !state.isFlipping) {
      drawCellHighlight(cx3d, cy3d, cz3d, cell, transform);
    }

    const symbol = state.board[idx];
    const anim = state.symbolAnimations[idx];
    const progress = anim ? anim.progress : 1;

    if (symbol) {
      if (symbol === 'X') {
        drawX3D(cx3d, cy3d, cz3d, cell * 0.32 * progress, transform, progress);
      } else {
        drawO3D(cx3d, cy3d, cz3d, cell * 0.32 * progress, transform, progress);
      }
    }
  }

  // Победная линия
  if (state.gameOver) {
    const winLine = getWinningLine(state.board);
    if (winLine) {
      drawWinningLine3D(winLine, transform);
    }
  }
}

function drawCellHighlight(cx, cy, cz, cell, transform) {
  const ctx = gameCtx;
  const halfCell = cell / 2 * 0.88;

  const corners = [
    [cx - halfCell, cy + halfCell, cz],
    [cx + halfCell, cy + halfCell, cz],
    [cx + halfCell, cy - halfCell, cz],
    [cx - halfCell, cy - halfCell, cz],
  ];

  const points = corners.map(c => projectPoint(c[0], c[1], c[2], transform));

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = '#2A3555';
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawX3D(cx, cy, cz, size, transform, progress = 1) {
  const ctx = gameCtx;

  // Свечение
  for (let offset = 3; offset > 0; offset--) {
    const alpha = (0.15 - offset * 0.04) * progress;
    const glowColor = lerpColor(COLORS.cubeTop, COLORS.xGlow, alpha * 2);
    const s = size * (1 + offset * 0.1);

    const p1 = projectPoint(cx - s, cy + s, cz, transform);
    const p2 = projectPoint(cx + s, cy - s, cz, transform);
    const p3 = projectPoint(cx + s, cy + s, cz, transform);
    const p4 = projectPoint(cx - s, cy - s, cz, transform);

    ctx.lineCap = 'round';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = CONFIG.LINE_WIDTH + offset * 2;

    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.stroke();
  }

  // Основные линии
  const p1 = projectPoint(cx - size, cy + size, cz, transform);
  const p2 = projectPoint(cx + size, cy - size, cz, transform);
  const p3 = projectPoint(cx + size, cy + size, cz, transform);
  const p4 = projectPoint(cx - size, cy - size, cz, transform);

  ctx.globalAlpha = progress;
  ctx.strokeStyle = COLORS.xColor;
  ctx.lineWidth = CONFIG.LINE_WIDTH;

  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawO3D(cx, cy, cz, radius, transform, progress = 1) {
  const ctx = gameCtx;

  // Свечение
  for (let offset = 3; offset > 0; offset--) {
    const alpha = (0.12 - offset * 0.03) * progress;
    const glowColor = lerpColor(COLORS.cubeTop, COLORS.oGlow, alpha * 2);
    const r = radius * (1 + offset * 0.1);
    drawEllipse3D(cx, cy, cz, r, transform, glowColor, CONFIG.LINE_WIDTH + offset * 2, progress);
  }

  // Основной круг
  drawEllipse3D(cx, cy, cz, radius, transform, COLORS.oColor, CONFIG.LINE_WIDTH, progress);
}

function drawEllipse3D(cx, cy, cz, radius, transform, color, width, progress = 1) {
  const ctx = gameCtx;
  const segments = 24;
  const points = [];

  for (let i = 0; i < segments; i++) {
    const angle = 2 * Math.PI * i / segments;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(projectPoint(x, y, cz, transform));
  }

  ctx.globalAlpha = progress;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWinningLine3D(line, transform) {
  const ctx = gameCtx;
  const size = transform.size;
  const half = size / 2;
  const cell = size / 3;
  const zFront = half;

  function cellCenter3D(idx) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const cx = -half + col * cell + cell / 2;
    const cy = half - row * cell - cell / 2;
    return [cx, cy, zFront];
  }

  const start = cellCenter3D(line[0]);
  const end = cellCenter3D(line[2]);

  // Свечение
  for (let offset = 5; offset > 0; offset--) {
    const alpha = 0.25 - offset * 0.04;
    const glowColor = lerpColor(COLORS.cubeTop, COLORS.winGlow, alpha * 2);

    const p1 = projectPoint(start[0], start[1], start[2], transform);
    const p2 = projectPoint(end[0], end[1], end[2], transform);

    ctx.lineCap = 'round';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = CONFIG.LINE_WIDTH + offset * 3;

    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
  }

  // Основная линия
  const p1 = projectPoint(start[0], start[1], start[2], transform);
  const p2 = projectPoint(end[0], end[1], end[2], transform);

  ctx.strokeStyle = COLORS.winColor;
  ctx.lineWidth = CONFIG.LINE_WIDTH + 2;

  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
}

// ══════════════════════════════════════════════════════════════════
// УТИЛИТЫ ЦВЕТОВ
// ══════════════════════════════════════════════════════════════════

function lerpColor(c1, c2, t) {
  const tClamped = Math.max(0, Math.min(1, t));
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * tClamped);
  const g = Math.round(g1 + (g2 - g1) * tClamped);
  const b = Math.round(b1 + (b2 - b1) * tClamped);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(c, factor) {
  const r = Math.round(parseInt(c.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(c.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(c.slice(5, 7), 16) * factor);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════
// ИГРОВАЯ ЛОГИКА
// ══════════════════════════════════════════════════════════════════

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== '')) {
    return 'draw';
  }
  return null;
}

function getWinningLine(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

function bestMoveForO(board) {
  const empties = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
  if (empties.length === 0) return 0;

  // 30% случайный ход
  if (Math.random() < 0.30) {
    return empties[Math.floor(Math.random() * empties.length)];
  }

  // Проверяем выигрыш
  for (const i of empties) {
    board[i] = 'O';
    if (checkWinner(board) === 'O') {
      board[i] = '';
      // 40% шанс пропустить победу
      if (Math.random() < 0.40) {
        const other = empties.filter(j => j !== i);
        if (other.length > 0) {
          return other[Math.floor(Math.random() * other.length)];
        }
      }
      return i;
    }
    board[i] = '';
  }

  // Блокируем игрока
  for (const i of empties) {
    board[i] = 'X';
    if (checkWinner(board) === 'X') {
      board[i] = '';
      // 50% шанс не заблокировать
      if (Math.random() < 0.50) {
        const other = empties.filter(j => j !== i);
        if (other.length > 0) {
          return other[Math.floor(Math.random() * other.length)];
        }
      }
      return i;
    }
    board[i] = '';
  }

  return empties[Math.floor(Math.random() * empties.length)];
}

function generatePromoCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// ══════════════════════════════════════════════════════════════════
// ОБРАБОТЧИКИ СОБЫТИЙ
// ══════════════════════════════════════════════════════════════════

function getCellFromMouse(x, y) {
  const transform = getCubeTransform(state.flipAngle);
  const size = transform.size;
  const half = size / 2;
  const cell = size / 3;
  const zFront = half;

  // Проверяем каждую ячейку
  for (let idx = 0; idx < 9; idx++) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;

    const cx3d = -half + col * cell + cell / 2;
    const cy3d = half - row * cell - cell / 2;

    // Углы ячейки
    const corners = [
      [cx3d - cell / 2, cy3d + cell / 2, zFront],
      [cx3d + cell / 2, cy3d + cell / 2, zFront],
      [cx3d + cell / 2, cy3d - cell / 2, zFront],
      [cx3d - cell / 2, cy3d - cell / 2, zFront],
    ];

    const points = corners.map(c => projectPoint(c[0], c[1], c[2], transform));

    if (pointInPolygon(x, y, points)) {
      return idx;
    }
  }

  return null;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function onMouseMove(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cell = getCellFromMouse(x, y);

  if (cell !== state.hoverCell) {
    state.hoverCell = cell;
    drawCube();
  }
}

function onMouseLeave() {
  if (state.hoverCell !== null) {
    state.hoverCell = null;
    drawCube();
  }
}

function onClick(e) {
  if (state.gameBlocked || state.gameOver || state.isFlipping || state.computerThinking) return;

  const rect = gameCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const idx = getCellFromMouse(x, y);

  if (idx !== null && state.board[idx] === '') {
    playClickSound();
    state.computerThinking = true;
    placeSymbol(idx, 'X');
    afterMove();

    if (!state.gameOver) {
      setTimeout(computerTurn, 450);
    }
  }
}

function placeSymbol(idx, symbol) {
  state.board[idx] = symbol;
  animateSymbol(idx);
}

function computerTurn() {
  if (state.gameOver) return;

  const idx = bestMoveForO([...state.board]);
  placeSymbol(idx, 'O');
  afterMove();
  state.computerThinking = false;
}

function afterMove() {
  const result = checkWinner(state.board);
  if (!result) return;

  state.gameOver = true;

  setTimeout(() => {
    drawCube();

    if (result === 'draw') {
      handleDraw();
    } else if (result === 'X') {
      handleWin();
    } else {
      handleLoss();
    }
  }, CONFIG.ANIM_STEPS * CONFIG.ANIM_DELAY + 50);
}

function handleWin() {
  state.promoCode = generatePromoCode();

  // Тряска
  animateShake();

  // Статус
  updateStatus('🎉 Победа!', 'win');

  // Кнопка с промокодом
  gameBtn.textContent = `Ваш промокод ${state.promoCode} отправлен в телеграм`;

  // Отправляем в Telegram
  sendTelegramMessage(`🎉 Победа! Ваш промокод: <b>${state.promoCode}</b>`);
}

function handleLoss() {
  updateStatus('', '');

  // Кнопка с сообщением
  gameBtn.textContent = 'Не повезло - попробуйте еще разок';

  // Отправляем в Telegram
  sendTelegramMessage('😔 Проигрыш. Попробуйте ещё раз!');
}

function handleDraw() {
  updateStatus('Ничья!', 'draw');
  gameBtn.textContent = 'Начать заново';
}

function reset(animate = true) {
  state.board = Array(9).fill('');
  state.gameOver = false;
  state.promoCode = null;
  state.hoverCell = null;
  state.computerThinking = false;
  state.symbolAnimations = {};

  statusText.className = 'status-text';
  updateStatus('');
  gameBtn.textContent = 'Начать заново';

  if (animate) {
    state.isFlipping = true;
    state.gameNumber++;
    state.flipDirection = state.gameNumber % 2 === 1 ? 1 : -1;
    animateFlip();
  } else {
    drawCube();
  }
}

// ══════════════════════════════════════════════════════════════════
// АНИМАЦИИ
// ══════════════════════════════════════════════════════════════════

function animateSymbol(idx) {
  state.symbolAnimations[idx] = { progress: 0 };

  let step = 0;
  function animate() {
    step++;
    const t = step / CONFIG.ANIM_STEPS;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

    state.symbolAnimations[idx].progress = eased;
    drawCube();

    if (step < CONFIG.ANIM_STEPS) {
      setTimeout(animate, CONFIG.ANIM_DELAY);
    }
  }

  animate();
}

function animateFlip(step = 0) {
  if (step > CONFIG.FLIP_STEPS) {
    state.isFlipping = false;
    state.flipAngle = 0;
    drawCube();
    return;
  }

  const t = step / CONFIG.FLIP_STEPS;
  const eased = 1 - Math.pow(1 - t, 3);

  state.flipAngle = eased * 360 * state.flipDirection;
  drawCube();

  setTimeout(() => animateFlip(step + 1), CONFIG.FLIP_DELAY);
}

function animateShake(step = 0, totalSteps = 20) {
  if (step >= totalSteps) {
    state.isShaking = false;
    state.shakeOffsetX = 0;
    state.shakeOffsetY = 0;
    drawCube();
    return;
  }

  state.isShaking = true;
  const decay = 1 - step / totalSteps;
  const intensity = 8 * decay;

  state.shakeOffsetX = (Math.random() - 0.5) * intensity * 2;
  state.shakeOffsetY = (Math.random() - 0.5) * intensity;

  drawCube();

  setTimeout(() => animateShake(step + 1, totalSteps), 30);
}

// ══════════════════════════════════════════════════════════════════
// UI
// ══════════════════════════════════════════════════════════════════

function updateStatus(text, type = '') {
  statusText.textContent = text;
  statusText.className = 'status-text' + (type ? ` ${type}` : '');
}

function onGameBtnClick() {
  playClickSound();
  reset();
}

/**
 * Вместо ввода логина:
 * 1. Генерируем sessionId
 * 2. Открываем бота с /start <sessionId>
 * 3. Циклом опрашиваем Worker по этому sessionId
 */
function onUsernameSubmit() {
  playClickSound();

  // Пробуем запустить музыку
  startMusic();

  if (usernameBtn.disabled) return;

  // Генерируем уникальный sessionId для связи с Telegram
  const sessionId = Math.random().toString(36).slice(2, 12);
  state.telegramSessionId = sessionId;

  usernameBtn.textContent = 'Откройте Telegram, нажмите «Start» и вернитесь в игру...';
  usernameBtn.disabled = true;

  // Открываем бота c /start <sessionId>
  const deepLink = `https://t.me/${CONFIG.BOT_USERNAME}?start=${sessionId}`;
  window.open(deepLink, '_blank');

  // Запускаем цикл проверки
  checkSubscriptionLoop();
}

// ══════════════════════════════════════════════════════════════════
// TELEGRAM API (через Cloudflare Worker)
// ══════════════════════════════════════════════════════════════════

async function sendTelegramMessage(text) {
  if (!CONFIG.WORKER_URL || !state.telegramChatId) {
    console.log('[Telegram] Skip message (no worker or chat ID):', text);
    return;
  }

  try {
    await fetch(`${CONFIG.WORKER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: state.telegramChatId,
        text: text,
      }),
    });
  } catch (e) {
    console.warn('[Telegram] Send failed:', e);
  }
}

async function checkUserSubscribed(sessionId) {
  if (!CONFIG.WORKER_URL) {
    console.log('[Telegram] Worker not configured, skip check');
    return null;
  }

  try {
    const response = await fetch(`${CONFIG.WORKER_URL}/check?session=${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    return data;
  } catch (e) {
    console.warn('[Telegram] Check failed:', e);
    return null;
  }
}

async function checkSubscriptionLoop(attempts = 0) {
  // Если Worker не настроен - сразу запускаем игру
  if (!CONFIG.WORKER_URL) {
    console.log('[Telegram] Worker not configured, starting game without verification');
    startGame();
    return;
  }

  if (attempts > 30) {
    // Timeout - сообщаем об ошибке
    usernameBtn.textContent = 'Не удалось найти чат. Попробовать ещё раз?';
    usernameBtn.disabled = false;
    return;
  }

  try {
    const result = await checkUserSubscribed(state.telegramSessionId);

    if (result && result.error) {
      // Ошибки от Worker (например, Telegram Error)
      alert(`❌ Ошибка Telegram:\n${result.error}\n\n${JSON.stringify(result.debug || {}, null, 2)}`);
      usernameBtn.textContent = 'Ошибка, попробовать ещё раз';
      usernameBtn.disabled = false;
      return;
    }

    if (result && result.chat_id) {
      state.telegramChatId = result.chat_id;
      startGame();
      return;
    }
  } catch (e) {
    console.warn('Check subscription error:', e);
  }

  // Повторяем через 2 секунды
  setTimeout(() => checkSubscriptionLoop(attempts + 1), 2000);
}

function startGame() {
  state.gameBlocked = false;
  usernameDialog.classList.remove('visible');
  updateStatus('');
  reset(false);
}
