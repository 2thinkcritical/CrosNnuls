export const SCENE_WIDTH = 420;
export const SCENE_HEIGHT = 380;
export const BOARD_SIZE = 300;
export const CELL_SIZE = BOARD_SIZE / 3;

const HALF = BOARD_SIZE / 2;
const TILT = 15 * Math.PI / 180;
const HEADING = -20 * Math.PI / 180;
const SCALE = 0.9;

export function cubeTransform(angle = 0) {
  const heading = HEADING + angle;
  return {
    cosHeading: Math.cos(heading), sinHeading: Math.sin(heading),
    cosTilt: Math.cos(TILT), sinTilt: Math.sin(TILT),
  };
}

export function rotatePoint([x, y, z], { cosHeading, sinHeading, cosTilt, sinTilt }) {
  const depth = z * cosHeading - x * sinHeading;
  return [
    x * cosHeading + z * sinHeading,
    y * cosTilt - depth * sinTilt,
    y * sinTilt + depth * cosTilt,
  ];
}

export function projectPoint(point, transform) {
  const [x, y] = rotatePoint(point, transform);
  return [SCENE_WIDTH / 2 + x * SCALE, SCENE_HEIGHT / 2 - 5 - y * SCALE];
}

export function cellCenter(index) {
  return [
    -HALF + (index % 3 + 0.5) * CELL_SIZE,
    HALF - (Math.floor(index / 3) + 0.5) * CELL_SIZE,
    HALF,
  ];
}

export function boardMatrix(width, height) {
  const sx = width / SCENE_WIDTH;
  const sy = height / SCENE_HEIGHT;
  const transform = cubeTransform();
  const [x, y] = projectPoint([-HALF, HALF, HALF], transform);
  const [rightX, rightY] = projectPoint([HALF, HALF, HALF], transform);
  const [bottomX, bottomY] = projectPoint([-HALF, -HALF, HALF], transform);

  // The Canvas projection is affine, so the CSS matrix maps the entire HTML grid to the same face.
  return [
    (rightX - x) * sx / BOARD_SIZE,
    (rightY - y) * sy / BOARD_SIZE,
    (bottomX - x) * sx / BOARD_SIZE,
    (bottomY - y) * sy / BOARD_SIZE,
    x * sx, y * sy,
  ];
}
