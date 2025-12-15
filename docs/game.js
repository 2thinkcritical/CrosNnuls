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
  nzRot = ny * Math.sin(tiltX) + nz * Math.cos(tilX);
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
        p2 = projectPoint(-half + t * s *
