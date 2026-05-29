/**
 * Unit tests for pure game logic in GameScene.js.
 * Uses Node's built-in test runner (node:test), no extra deps.
 * Run: npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Stub Phaser so GameScene.js can be eval'd in Node
globalThis.Phaser = { Scene: class {} };
globalThis.APP_VERSION = 'test';

let _store = {};
globalThis.localStorage = {
    getItem:    k     => _store[k] ?? null,
    setItem:    (k,v) => { _store[k] = v; },
    removeItem: k     => { delete _store[k]; },
    clear:      ()    => { _store = {}; },
};

const src = readFileSync(join(__dirname, '../src/GameScene.js'), 'utf8');
eval(`(function(){ ${src}; globalThis.GameScene = GameScene; })()`);

// Helper: make a uniform board
const makeBoard = (rows, cols, fill) =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ ...fill })));

// ── isGameOver ────────────────────────────────────────────

describe('isGameOver', () => {
    test('false when board has any empty cell', () => {
        const board = makeBoard(3, 3, { level: 1, type: 0 });
        board[1][1] = { level: 0, type: null };
        assert.equal(GameScene.prototype.isGameOver.call({ ROWS: 3, COLS: 3, board }), false);
    });

    test('false when full board contains a mergeable pair', () => {
        // two cells with same type+level → can merge → not over
        const board = makeBoard(3, 3, { level: 0, type: null });
        let n = 0;
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 3; c++)
                board[r][c] = { level: n + 1, type: n++ };
        // overwrite last cell to duplicate first → now there's a pair
        board[2][2] = { level: 1, type: 0 };
        assert.equal(GameScene.prototype.isGameOver.call({ ROWS: 3, COLS: 3, board }), false);
    });

    test('true when full board has no mergeable pairs (all unique)', () => {
        const board = makeBoard(3, 3, { level: 0, type: null });
        let n = 0;
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 3; c++)
                board[r][c] = { level: n + 1, type: n++ };  // 9 unique combos
        assert.equal(GameScene.prototype.isGameOver.call({ ROWS: 3, COLS: 3, board }), true);
    });

    test('basket cells (level -1) do not count as pairs or empties', () => {
        // board full of baskets — no empties, no element pairs → game over
        const board = makeBoard(2, 2, { level: -1, type: 0 });
        assert.equal(GameScene.prototype.isGameOver.call({ ROWS: 2, COLS: 2, board }), true);
    });
});

// ── pointerToCell ─────────────────────────────────────────

describe('pointerToCell', () => {
    // Replicate create() math for a typical layout
    const ctx = { COLS: 7, ROWS: 9, CELL_SIZE: 98, GAP: 8, offsetX: 10, offsetY: 166 };
    const stride = ctx.CELL_SIZE + ctx.GAP; // 106

    test('center of first cell → {row:0, col:0}', () => {
        const x = ctx.offsetX + ctx.CELL_SIZE / 2;
        const y = ctx.offsetY + ctx.CELL_SIZE / 2;
        assert.deepEqual(
            GameScene.prototype.pointerToCell.call(ctx, { x, y }),
            { row: 0, col: 0 }
        );
    });

    test('center of cell (2, 3) → correct row/col', () => {
        const x = ctx.offsetX + 3 * stride + ctx.CELL_SIZE / 2;
        const y = ctx.offsetY + 2 * stride + ctx.CELL_SIZE / 2;
        assert.deepEqual(
            GameScene.prototype.pointerToCell.call(ctx, { x, y }),
            { row: 2, col: 3 }
        );
    });

    test('pointer above grid → null', () => {
        assert.equal(GameScene.prototype.pointerToCell.call(ctx, { x: 360, y: 0 }), null);
    });

    test('pointer left of grid → null', () => {
        assert.equal(GameScene.prototype.pointerToCell.call(ctx, { x: 0, y: 300 }), null);
    });
});

// ── loadSave ──────────────────────────────────────────────

describe('loadSave', () => {
    test('returns false when localStorage has no save', () => {
        localStorage.clear();
        assert.equal(GameScene.prototype.loadSave.call({}), false);
    });

    test('returns false for corrupted JSON', () => {
        localStorage.setItem('mergeSave', '{bad json}');
        assert.equal(GameScene.prototype.loadSave.call({}), false);
    });

    test('returns false when board field is missing', () => {
        localStorage.setItem('mergeSave', JSON.stringify({ score: 100 }));
        assert.equal(GameScene.prototype.loadSave.call({}), false);
    });

    test('restores board, score, unlocks, tasksCompleted from valid save', () => {
        const board = makeBoard(2, 2, { level: 1, type: 0 });
        localStorage.setItem('mergeSave', JSON.stringify({
            board, score: 42, tasksCompleted: 3,
            basket2Unlocked: true, basket3Unlocked: false, basket4Unlocked: true,
            customers: [],
        }));
        const ctx = {};
        assert.equal(GameScene.prototype.loadSave.call(ctx), true);
        assert.equal(ctx.score, 42);
        assert.equal(ctx.tasksCompleted, 3);
        assert.equal(ctx.basket2Unlocked, true);
        assert.equal(ctx.basket3Unlocked, false);
        assert.equal(ctx.basket4Unlocked, true);
        assert.deepEqual(ctx.board, board);
    });
});

// ── restoreSavedCustomers ─────────────────────────────────

describe('restoreSavedCustomers', () => {
    test('skips customer whose timer already expired while app was closed', () => {
        const spawned = [];
        const ctx = {
            BASKET_CONFIGS: [{ color: 0 }],
            _savedCustomers: [{ type: 0, level: 2, slot: 0, charId: null, expiryAt: Date.now() - 5000 }],
            spawnCustomer: c => spawned.push(c),
        };
        GameScene.prototype.restoreSavedCustomers.call(ctx);
        assert.equal(spawned.length, 0);
    });

    test('restores customer with time remaining', () => {
        const spawned = [];
        const ctx = {
            BASKET_CONFIGS: [{ color: 0 }],
            _savedCustomers: [{ type: 0, level: 2, slot: 0, charId: null, expiryAt: Date.now() + 30000 }],
            spawnCustomer: c => spawned.push(c),
        };
        GameScene.prototype.restoreSavedCustomers.call(ctx);
        assert.equal(spawned.length, 1);
        assert.equal(spawned[0].level, 2);
    });

    test('always restores energy-based customer (no expiry timer)', () => {
        const spawned = [];
        const ctx = {
            BASKET_CONFIGS: [{ color: 0, energyBased: true }],
            _savedCustomers: [{ type: 0, level: 3, slot: 1, charId: null, expiryAt: null }],
            spawnCustomer: c => spawned.push(c),
        };
        GameScene.prototype.restoreSavedCustomers.call(ctx);
        assert.equal(spawned.length, 1);
    });

    test('clears _savedCustomers after restore', () => {
        const ctx = {
            BASKET_CONFIGS: [{ color: 0 }],
            _savedCustomers: [{ type: 0, level: 2, slot: 0, charId: null, expiryAt: Date.now() + 10000 }],
            spawnCustomer: () => {},
        };
        GameScene.prototype.restoreSavedCustomers.call(ctx);
        assert.equal(ctx._savedCustomers.length, 0);
    });
});
