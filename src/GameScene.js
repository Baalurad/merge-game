class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.COLS = 7;
        this.ROWS = 7;
        this.GAP = 8;

        const cellW = Math.floor((680 - (this.COLS - 1) * this.GAP) / this.COLS);
        const cellH = Math.floor((940 - (this.ROWS - 1) * this.GAP) / this.ROWS);
        this.CELL_SIZE = Math.min(cellW, cellH, 98);

        const gridW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP;
        const gridH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP;
        this.offsetX = (720 - gridW) / 2;
        this.offsetY = 100 + (980 - gridH) / 2;

        // Each basket type: color of the basket cell, label color, element colors per level
        this.BASKET_CONFIGS = [
            {
                color: 0xf39c12,
                labelColor: '#1a1a2e',
                elemColors: [null, 0xe74c3c, 0xe67e22, 0xf1c40f, 0x27ae60, 0xf39c12, 0xd35400, 0xc0392b, 0xffd700],
            },
            {
                color: 0x8e44ad,
                labelColor: '#ffffff',
                elemColors: [null, 0x3498db, 0x1abc9c, 0x2980b9, 0x8e44ad, 0x9b59b6, 0x6c3483, 0x1a5276, 0xd2b4de],
            },
        ];

        this.LABELS = ['', '1', '2', '3', '4', '5', '6', '7', '★'];

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('mergeHighScore') || '0');

        this.isAnimating = false;
        this.spawnCooldown = false;

        // Drag state (shared between elements and baskets)
        this.dragSrc = null;      // { row, col, isBasket }
        this.dragVisual = null;
        this.dragLabelVisual = null;

        // Long-press state
        this.longPressTimer = null;
        this.longPressSrc = null;
        this.lastPointerPos = { x: 0, y: 0 };

        // board[r][c] = { level, type }
        // level: -1 = basket, 0 = empty, 1-8 = element
        // type: basket index (0, 1, ...) or null for empty
        this.board = [];
        this.initBoard();
        this.createUI();
        this.createGrid();
        this.updateGrid();

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
    }

    initBoard() {
        for (let r = 0; r < this.ROWS; r++) {
            this.board[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.board[r][c] = { level: 0, type: null };
            }
        }
        this.board[3][2] = { level: -1, type: 0 };
        this.board[3][4] = { level: -1, type: 1 };
    }

    createUI() {
        this.add.rectangle(360, 50, 720, 100, 0x16213e);
        this.scoreText = this.add.text(24, 28, 'Score: 0', {
            fontSize: '28px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        });
        this.highScoreText = this.add.text(696, 28, `Best: ${this.highScore}`, {
            fontSize: '22px', fill: '#aaaaaa', fontFamily: 'Arial',
        }).setOrigin(1, 0);
        this.add.text(720, 1076, `v${APP_VERSION}`, {
            fontSize: '18px', fill: '#2a2a4a', fontFamily: 'Arial',
        }).setOrigin(1, 1);
    }

    createGrid() {
        this.cellObjects = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.cellObjects[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                const { x, y } = this.getCellPos(r, c);
                const s = this.CELL_SIZE;

                const bg = this.add.rectangle(x, y, s, s, 0x16213e)
                    .setStrokeStyle(2, 0x0f3460);

                const elem = this.add.rectangle(x, y, s - 12, s - 12, 0x0f3460)
                    .setAlpha(0.2);

                const label = this.add.text(x, y, '', {
                    fontSize: `${Math.floor(s * 0.35)}px`,
                    fill: '#ffffff',
                    fontFamily: 'Arial',
                    fontStyle: 'bold',
                }).setOrigin(0.5);

                this.cellObjects[r][c] = { bg, elem, label, baseX: x, baseY: y };
            }
        }
    }

    getCellPos(row, col) {
        return {
            x: this.offsetX + col * (this.CELL_SIZE + this.GAP) + this.CELL_SIZE / 2,
            y: this.offsetY + row * (this.CELL_SIZE + this.GAP) + this.CELL_SIZE / 2,
        };
    }

    updateGrid() {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.updateCell(r, c);
            }
        }
    }

    updateCell(row, col) {
        const { level, type } = this.board[row][col];
        const obj = this.cellObjects[row][col];

        if (level === -1) {
            const cfg = this.BASKET_CONFIGS[type];
            obj.bg.setStrokeStyle(2, cfg.color);
            obj.elem.setFillStyle(cfg.color).setAlpha(1)
                .setPosition(obj.baseX, obj.baseY).setScale(1);
            obj.label.setText('+1').setStyle({ fill: cfg.labelColor })
                .setPosition(obj.baseX, obj.baseY).setScale(1);
        } else if (level === 0) {
            obj.bg.setStrokeStyle(2, 0x0f3460);
            obj.elem.setFillStyle(0x0f3460).setAlpha(0.2)
                .setPosition(obj.baseX, obj.baseY).setScale(1);
            obj.label.setText('').setPosition(obj.baseX, obj.baseY).setScale(1);
        } else {
            const cfg = this.BASKET_CONFIGS[type];
            obj.bg.setStrokeStyle(2, 0x0f3460);
            obj.elem.setFillStyle(cfg.elemColors[level]).setAlpha(1)
                .setPosition(obj.baseX, obj.baseY).setScale(1);
            obj.label.setText(this.LABELS[level]).setStyle({ fill: '#ffffff' })
                .setPosition(obj.baseX, obj.baseY).setScale(1);
        }
    }

    pointerToCell(pointer) {
        const col = Math.floor((pointer.x - this.offsetX) / (this.CELL_SIZE + this.GAP));
        const row = Math.floor((pointer.y - this.offsetY) / (this.CELL_SIZE + this.GAP));
        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return null;
        return { row, col };
    }

    // ── INPUT ──────────────────────────────────────────────

    onPointerDown(pointer) {
        if (this.isAnimating) return;
        this.lastPointerPos = { x: pointer.x, y: pointer.y };

        const cell = this.pointerToCell(pointer);
        if (!cell) return;
        const { row, col } = cell;
        const { level } = this.board[row][col];

        if (level === -1) {
            this.longPressSrc = { row, col };
            this.longPressTimer = this.time.delayedCall(200, () => {
                this.longPressTimer = null;
                this.startDrag(row, col, this.lastPointerPos, true);
            });
            return;
        }

        if (level > 0) {
            this.startDrag(row, col, pointer, false);
        }
    }

    onPointerMove(pointer) {
        this.lastPointerPos = { x: pointer.x, y: pointer.y };

        if (this.longPressTimer && this.longPressSrc) {
            const { x: bx, y: by } = this.getCellPos(this.longPressSrc.row, this.longPressSrc.col);
            if (Math.abs(pointer.x - bx) > 15 || Math.abs(pointer.y - by) > 15) {
                this.longPressTimer.remove();
                this.longPressTimer = null;
                this.longPressSrc = null;
            }
        }

        if (!this.dragSrc) return;
        this.dragVisual.setPosition(pointer.x, pointer.y);
        this.dragLabelVisual.setPosition(pointer.x, pointer.y);
    }

    onPointerUp(pointer) {
        if (this.longPressTimer) {
            this.longPressTimer.remove();
            this.longPressTimer = null;
            const src = this.longPressSrc;
            this.longPressSrc = null;
            if (src) this.spawnFromBasket(src.row, src.col);
            return;
        }
        this.longPressSrc = null;

        if (!this.dragSrc) return;
        const cell = this.pointerToCell(pointer);
        this.endDrag(cell);
    }

    // ── DRAG ──────────────────────────────────────────────

    startDrag(row, col, pointer, isBasket) {
        this.dragSrc = { row, col, isBasket };
        const { level, type } = this.board[row][col];
        const cfg = this.BASKET_CONFIGS[type];
        const color = isBasket ? cfg.color : cfg.elemColors[level];
        const labelText = isBasket ? '+1' : this.LABELS[level];
        const labelColor = isBasket ? cfg.labelColor : '#ffffff';

        this.dragVisual = this.add.rectangle(pointer.x, pointer.y,
            this.CELL_SIZE - 12, this.CELL_SIZE - 12, color)
            .setDepth(20).setAlpha(0.9);

        this.dragLabelVisual = this.add.text(pointer.x, pointer.y, labelText, {
            fontSize: `${Math.floor(this.CELL_SIZE * 0.35)}px`,
            fill: labelColor, fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);

        const obj = this.cellObjects[row][col];
        obj.elem.setAlpha(0.2);
        obj.label.setAlpha(0.2);
    }

    endDrag(targetCell) {
        const src = this.dragSrc;
        this.dragSrc = null;
        this.dragVisual.destroy();      this.dragVisual = null;
        this.dragLabelVisual.destroy(); this.dragLabelVisual = null;

        const srcObj = this.cellObjects[src.row][src.col];
        srcObj.elem.setAlpha(1);
        srcObj.label.setAlpha(1);

        if (!targetCell) return;
        const { row: tr, col: tc } = targetCell;
        if (tr === src.row && tc === src.col) return;

        const srcCell = this.board[src.row][src.col];
        const tgtCell = this.board[tr][tc];

        if (src.isBasket) {
            if (tgtCell.level === 0) {
                this.board[tr][tc] = { ...srcCell };
                this.board[src.row][src.col] = { level: 0, type: null };
                this.updateCell(src.row, src.col);
                this.updateCell(tr, tc);
            }
            return;
        }

        if (tgtCell.level === srcCell.level && tgtCell.type === srcCell.type) {
            this.performMerge(src.row, src.col, tr, tc);
        } else if (tgtCell.level === 0) {
            this.board[tr][tc] = { ...srcCell };
            this.board[src.row][src.col] = { level: 0, type: null };
            this.updateGrid();
        }
    }

    performMerge(srcRow, srcCol, tgtRow, tgtCol) {
        this.isAnimating = true;
        const srcCell = this.board[srcRow][srcCol];
        const newLevel = Math.min(srcCell.level + 1, 8);
        const { x: tx, y: ty } = this.getCellPos(tgtRow, tgtCol);
        const srcObj = this.cellObjects[srcRow][srcCol];

        this.tweens.add({
            targets: [srcObj.elem, srcObj.label],
            x: tx, y: ty, scaleX: 0, scaleY: 0,
            duration: 160, ease: 'Power2',
            onComplete: () => {
                this.board[srcRow][srcCol] = { level: 0, type: null };
                this.board[tgtRow][tgtCol] = { level: newLevel, type: srcCell.type };

                this.score += srcCell.level * 10;
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('mergeHighScore', String(this.highScore));
                }
                this.scoreText.setText(`Score: ${this.score}`);
                this.highScoreText.setText(`Best: ${this.highScore}`);
                this.updateGrid();

                const tgtObj = this.cellObjects[tgtRow][tgtCol];
                this.tweens.add({
                    targets: [tgtObj.elem, tgtObj.label],
                    scaleX: 1.25, scaleY: 1.25,
                    duration: 120, yoyo: true, ease: 'Back',
                    onComplete: () => {
                        this.isAnimating = false;
                        if (this.isGameOver()) this.time.delayedCall(400, () => this.showGameOver());
                    },
                });
            },
        });
    }

    // ── SPAWN ─────────────────────────────────────────────

    spawnFromBasket(basketRow, basketCol) {
        if (this.spawnCooldown) return;
        this.spawnCooldown = true;
        this.time.delayedCall(300, () => { this.spawnCooldown = false; });

        const { type } = this.board[basketRow][basketCol];
        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = basketRow + dr, c = basketCol + dc;
                if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && this.board[r][c].level === 0) {
                    candidates.push([r, c]);
                }
            }
        }

        if (candidates.length === 0) { this.flashBasket(basketRow, basketCol); return; }

        const [r, c] = Phaser.Utils.Array.GetRandom(candidates);
        this.board[r][c] = { level: 1, type };
        this.updateCell(r, c);

        const obj = this.cellObjects[r][c];
        obj.elem.setScale(0);
        obj.label.setScale(0);
        this.tweens.add({
            targets: [obj.elem, obj.label],
            scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out',
        });
    }

    flashBasket(row, col) {
        const obj = this.cellObjects[row][col];
        this.tweens.add({
            targets: obj.elem, alpha: 0.2, duration: 80,
            yoyo: true, repeat: 3,
            onComplete: () => obj.elem.setAlpha(1),
        });
    }

    // ── GAME OVER ─────────────────────────────────────────

    isGameOver() {
        const counts = {};
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const { level, type } = this.board[r][c];
                if (level === 0) return false;
                if (level > 0) {
                    const key = `${type}-${level}`;
                    if (counts[key]) return false;
                    counts[key] = true;
                }
            }
        }
        return true;
    }

    showGameOver() {
        const cx = 360, cy = 540;
        this.add.rectangle(cx, cy, 400, 240, 0x000000, 0.85).setDepth(10);
        this.add.text(cx, cy - 70, 'Game Over!', {
            fontSize: '36px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);
        this.add.text(cx, cy - 10, `Score: ${this.score}`, {
            fontSize: '28px', fill: '#f1c40f', fontFamily: 'Arial',
        }).setOrigin(0.5).setDepth(11);
        const btn = this.add.text(cx, cy + 60, '[ Play Again ]', {
            fontSize: '30px', fill: '#2ecc71', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11).setInteractive();
        btn.on('pointerdown', () => this.scene.restart());
    }
}
