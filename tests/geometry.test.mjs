import assert from 'node:assert/strict';
import test from 'node:test';
import { BOARD_SIZE, SCENE_HEIGHT, SCENE_WIDTH, boardMatrix, cellCenter, cubeTransform, projectPoint } from '../docs/geometry.js';

test('projected HTML targets stay aligned with Canvas cell centers on wide and narrow screens', () => {
  for (const [width, height] of [[420, 380], [520, 470], [240, 217]]) {
    const [a, b, c, d, x, y] = boardMatrix(width, height);
    const cell = BOARD_SIZE / 3;
    for (const index of [0, 4, 8]) {
      const gridX = (index % 3 + 0.5) * cell;
      const gridY = (Math.floor(index / 3) + 0.5) * cell;
      const [px, py] = projectPoint(cellCenter(index), cubeTransform());
      assert.ok(Math.abs(a * gridX + c * gridY + x - px * width / SCENE_WIDTH) < 0.001);
      assert.ok(Math.abs(b * gridX + d * gridY + y - py * height / SCENE_HEIGHT) < 0.001);
    }
  }
});
