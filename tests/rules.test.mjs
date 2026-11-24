import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseComputerMove, getOutcome, newRound, placeMark } from '../docs/rules.js';

test('finds every winning line for either mark', () => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const mark of ['X', 'O']) {
    for (const line of lines) {
      const board = Array(9).fill('');
      for (const index of line) board[index] = mark;
      assert.deepEqual(getOutcome(board), { result: mark, winningLine: line });
    }
  }
});

test('distinguishes an unfinished board from a full draw', () => {
  assert.equal(getOutcome(['X', '', '', '', 'O', '', '', '', '']), null);
  assert.deepEqual(getOutcome(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), {
    result: 'draw', winningLine: null,
  });
});

test('enforces legal turn order and ignores occupied, invalid, or terminal moves', () => {
  const initial = newRound();
  assert.equal(placeMark(initial, 0, 'O'), initial);
  assert.equal(placeMark(initial, -1, 'X'), initial);
  assert.equal(placeMark(initial, 9, 'X'), initial);
  assert.equal(placeMark(initial, 1.5, 'X'), initial);

  const first = placeMark(initial, 0, 'X');
  assert.equal(initial.board[0], '');
  assert.equal(first.turn, 'O');
  assert.equal(placeMark(first, 0, 'O'), first);
  assert.equal(placeMark(first, 8, 'X'), first);

  const finished = [[1, 'O'], [4, 'X'], [2, 'O'], [8, 'X']]
    .reduce((round, [index, mark]) => placeMark(round, index, mark), first);
  assert.deepEqual(finished.outcome, { result: 'X', winningLine: [0, 4, 8] });
  assert.equal(placeMark(finished, 3, 'O'), finished);
});

test('the computer takes an available win or blocks an immediate threat', () => {
  const reliable = () => 0.9;
  assert.equal(chooseComputerMove(['O', 'O', '', 'X', 'X', '', '', '', ''], reliable), 2);
  assert.equal(chooseComputerMove(['X', 'X', '', 'O', '', '', '', '', ''], reliable), 2);
});

test('the computer plays only available squares without mutating its input', () => {
  const board = Object.freeze(['X', 'O', '', '', '', '', '', '', '']);
  for (let i = 0; i < 100; i++) {
    assert.ok([2, 3, 4, 5, 6, 7, 8].includes(chooseComputerMove(board)));
  }
  assert.equal(chooseComputerMove(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']), null);
});
