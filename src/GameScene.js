class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.COLS = 7;
        this.ROWS = 7;
        this.BASKET_ROW = 3;
        this.BASKET_COL = 3;
        this.GAP = 8;

        const cellW = Math.floor((680 - (this.COLS - 1) * this.GAP) / this.COLS);
        const cellH = Math.floor((940 - (this.ROWS - 1) * this.GAP) / this.ROWS);
        this.CELL_SIZE = Math.min(cellW, cellH, 98);

        const gridW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP;
        const gridH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP;
        this.offsetX = (720 - gridW) / 2;
        this.offsetY = 100 + (980 - gridH) / 2;

        this.COLORS = [
            0x0f3460, // 0: пусто
            0xe74c3c, // 1
            0xe67e22, // 2
            0xf1c40f, // 3
            0x2ecc71, // 4
            0x1abc9c, // 5
            0x3498db, // 6
            0x9b59b6, // 7
            0xf39c12, // 8
        ];
        this.LABELS = ['', '1', '2', '3', '4', '5', '6', '7', '★'];

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('mergeHighScore') || '0');
        this.isAnimating = false;
        this.dragSrc = null;
        this.dragVisual = null;
        this.dragLabelVisual = null;

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
            this.board[r] = new Array(this.COLS).fill(0);
        }
        this.board[this.BASKET_ROW][this.BASKET_COL] = -1;
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
                const isBasket = r === this.BASKET_ROW && c === this.BASKET_COL;

                const bg = this.add.rectangle(x, y, s, s, 0x16213e)
                    .setStrokeStyle(2, isBasket ? 0xffd700 : 0x0f3460);

                const elem = this.add.rectangle(x, y, s - 12, s - 12,
                    isBasket ? 0xffd700 : 0x0f3460)
                    .setAlpha(isBasket ? 1 : 0.2);

                const label = this.add.text(x, y, isBasket ? '+1' : '', {
                    fontSize: `${Math.floor(s * 0.35)}px`,
                    fill: isBasket ? '#1a1a2e' : '#ffffff',
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
        const level = this.board[row][col];
        const obj = this.cellObjects[row][col];

        if (level === -1) {
            obj.elem.setFillStyle(0xffd700).setAlpha(1).setPosition(obj.baseX, obj.baseY).setScale(1);
            obj.label.setText('+1').setStyle({ fill: '#1a1a2e' }).setPosition(obj.baseX, obj.baseY).setScale(1);
        } else {
            obj.elem.setFillStyle(this.COLORS[level]).setAlpha(level === 0 ? 0.2 : 1)
                .setPosition(obj.baseX, obj.baseY).setScale(1);
            obj.label.setText(level > 0 ? this.LABELS[level] : '')
                .setStyle({ fill: '#ffffff' }).setPosition(obj.baseX, obj.baseY).setScale(1);
        }
    }

    pointerToCell(pointer) {
        const col = Math.floor((pointer.x - this.offsetX) / (this.CELL_SIZE + this.GAP));
        const row = Math.floor((pointer.y - this.offsetY) / (this.CELL_SIZE + this.GAP));
        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return null;
        return { row, col };
    }

    onPointerDown(pointer) {
        if (this.isAnimating) return;
        const cell = this.pointerToCell(pointer);
        if (!cell) return;
        const { row, col } = cell;

        if (row === this.BASKET_ROW && col === this.BASKET_COL) {
            this.spawnFromBasket();
            return;
        }

        if (this.board[row][col] > 0) {
            this.startDrag(row, col, pointer);
        }
    }

    onPointerMove(pointer) {
        if (!this.dragSrc) return;
        this.dragVisual.setPosition(pointer.x, pointer.y);
        this.dragLabelVisual.setPosition(pointer.x, pointer.y);
    }

    onPointerUp(pointer) {
        if (!this.dragSrc) return;
        const cell = this.pointerToCell(pointer);
        this.endDrag(cell);
    }

    startDrag(row, col, pointer) {
        this.dragSrc = { row, col };
        const level = this.board[row][col];

        this.dragVisual = this.add.rectangle(pointer.x, pointer.y,
            this.CELL_SIZE - 12, this.CELL_SIZE - 12, this.COLORS[level])
            .setDepth(20).setAlpha(0.9);

        this.dragLabelVisual = this.add.text(pointer.x, pointer.y, this.LABELS[level], {
            fontSize: `${Math.floor(this.CELL_SIZE * 0.38)}px`,
            fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);

        const obj = this.cellObjects[row][col];
        obj.elem.setAlpha(0.2);
        obj.label.setAlpha(0.2);
    }

    endDrag(targetCell) {
        const src = this.dragSrc;
        this.dragSrc = null;

        this.dragVisual.destroy();   this.dragVisual = null;
        this.dragLabelVisual.destroy(); this.dragLabelVisual = null;

        const srcObj = this.cellObjects[src.row][src.col];
        srcObj.elem.setAlpha(1);
        srcObj.label.setAlpha(1);

        if (!targetCell) return;
        const { row: tr, col: tc } = targetCell;
        if (tr === src.row && tc === src.col) return;

        const srcLevel = this.board[src.row][src.col];
        const tgtLevel = this.board[tr][tc];

        if (tgtLevel === srcLevel) {
            this.performMerge(src.row, src.col, tr, tc);
        } else if (tgtLevel === 0) {
            this.board[tr][tc] = srcLevel;
            this.board[src.row][src.col] = 0;
            this.updateGrid();
        }
    }

    performMerge(srcRow, srcCol, tgtRow, tgtCol) {
        this.isAnimating = true;
        const level = this.board[srcRow][srcCol];
        const newLevel = Math.min(level + 1, 8);
        const { x: tx, y: ty } = this.getCellPos(tgtRow, tgtCol);
        const srcObj = this.cellObjects[srcRow][srcCol];

        this.tweens.add({
            targets: [srcObj.elem, srcObj.label],
            x: tx, y: ty, scaleX: 0, scaleY: 0,
            duration: 160,
            ease: 'Power2',
            onComplete: () => {
                this.board[srcRow][srcCol] = 0;
                this.board[tgtRow][tgtCol] = newLevel;

                this.score += level * 10;
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
                        if (this.isGameOver()) {
                            this.time.delayedCall(400, () => this.showGameOver());
                        }
                    },
                });
            },
        });
    }

    spawnFromBasket() {
        if (this.spawnCooldown) return;
        this.spawnCooldown = true;
        this.time.delayedCall(300, () => { this.spawnCooldown = false; });

        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = this.BASKET_ROW + dr;
                const c = this.BASKET_COL + dc;
                if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && this.board[r][c] === 0) {
                    candidates.push([r, c]);
                }
            }
        }

        if (candidates.length === 0) {
            this.flashBasket();
            return;
        }

        const [r, c] = Phaser.Utils.Array.GetRandom(candidates);
        this.board[r][c] = 1;
        this.updateCell(r, c);

        const obj = this.cellObjects[r][c];
        obj.elem.setScale(0);
        obj.label.setScale(0);
        this.tweens.add({
            targets: [obj.elem, obj.label],
            scaleX: 1, scaleY: 1,
            duration: 200, ease: 'Back.Out',
        });
    }

    flashBasket() {
        const obj = this.cellObjects[this.BASKET_ROW][this.BASKET_COL];
        this.tweens.add({
            targets: obj.elem,
            alpha: 0.2, duration: 80,
            yoyo: true, repeat: 3,
            onComplete: () => obj.elem.setAlpha(1),
        });
    }

    isGameOver() {
        const levels = new Set();
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const l = this.board[r][c];
                if (l === 0) return false;
                if (l > 0) {
                    if (levels.has(l)) return false;
                    levels.add(l);
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
