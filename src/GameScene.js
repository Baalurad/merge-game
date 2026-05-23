class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.COLS = 6;
        this.ROWS = 7;
        this.GAP = 8;

        const availW = 720 - 40;
        const availH = 1080 - 100 - 40;
        const cellW = Math.floor((availW - (this.COLS - 1) * this.GAP) / this.COLS);
        const cellH = Math.floor((availH - (this.ROWS - 1) * this.GAP) / this.ROWS);
        this.CELL_SIZE = Math.min(cellW, cellH, 110);

        const gridW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP;
        const gridH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP;
        this.offsetX = (720 - gridW) / 2;
        this.offsetY = 100 + (980 - gridH) / 2;

        this.COLORS = [
            0x0f3460, // 0: empty
            0xe74c3c, // 1: красный
            0xe67e22, // 2: оранжевый
            0xf1c40f, // 3: жёлтый
            0x2ecc71, // 4: зелёный
            0x1abc9c, // 5: бирюзовый
            0x3498db, // 6: синий
            0x9b59b6, // 7: фиолетовый
            0xf39c12, // 8: золотой
        ];
        this.LABELS = ['', '1', '2', '3', '4', '5', '6', '7', '★'];

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('mergeHighScore') || '0');
        this.isAnimating = false;

        this.board = [];
        this.initBoard();
        this.createUI();
        this.createGrid();
        this.updateGrid();

        this.input.on('pointerdown', this.onTap, this);
    }

    initBoard() {
        for (let r = 0; r < this.ROWS; r++) {
            this.board[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.board[r][c] = Math.random() < 0.55 ? Phaser.Math.Between(1, 3) : 0;
            }
        }
    }

    createUI() {
        this.add.rectangle(360, 50, 720, 100, 0x16213e);

        this.scoreText = this.add.text(24, 28, 'Очки: 0', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
        });

        this.highScoreText = this.add.text(696, 28, `Рекорд: ${this.highScore}`, {
            fontSize: '22px',
            fill: '#aaaaaa',
            fontFamily: 'Arial',
        }).setOrigin(1, 0);
    }

    createGrid() {
        this.cellObjects = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.cellObjects[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                const { x, y } = this.getCellPos(r, c);
                const s = this.CELL_SIZE;

                this.add.rectangle(x, y, s, s, 0x16213e).setStrokeStyle(2, 0x0f3460);

                const elem = this.add.rectangle(x, y, s - 12, s - 12, 0x0f3460);

                const label = this.add.text(x, y, '', {
                    fontSize: `${Math.floor(s * 0.38)}px`,
                    fill: '#ffffff',
                    fontFamily: 'Arial',
                    fontStyle: 'bold',
                }).setOrigin(0.5);

                this.cellObjects[r][c] = { elem, label, baseX: x, baseY: y };
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
        obj.elem.setFillStyle(this.COLORS[level]);
        obj.elem.setAlpha(level === 0 ? 0.2 : 1);
        obj.elem.setPosition(obj.baseX, obj.baseY).setScale(1);
        obj.label.setText(level > 0 ? this.LABELS[level] : '');
        obj.label.setPosition(obj.baseX, obj.baseY).setScale(1);
    }

    findConnected(row, col) {
        const level = this.board[row][col];
        if (level === 0) return [];

        const visited = new Set();
        const queue = [[row, col]];
        const result = [];

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            if (visited.has(key)) continue;
            visited.add(key);
            result.push([r, c]);

            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < this.ROWS && nc >= 0 && nc < this.COLS) {
                    if (!visited.has(`${nr},${nc}`) && this.board[nr][nc] === level) {
                        queue.push([nr, nc]);
                    }
                }
            }
        }
        return result;
    }

    onTap(pointer) {
        if (this.isAnimating) return;

        const col = Math.floor((pointer.x - this.offsetX) / (this.CELL_SIZE + this.GAP));
        const row = Math.floor((pointer.y - this.offsetY) / (this.CELL_SIZE + this.GAP));

        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return;

        const level = this.board[row][col];
        if (level === 0) return;
        if (level === 8) { this.flashCell(row, col); return; }

        const connected = this.findConnected(row, col);
        if (connected.length < 2) { this.flashCell(row, col); return; }

        const points = connected.length * level * 10;
        this.score += points;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('mergeHighScore', String(this.highScore));
        }
        this.scoreText.setText(`Очки: ${this.score}`);
        this.highScoreText.setText(`Рекорд: ${this.highScore}`);

        this.isAnimating = true;
        this.animateMerge(connected, row, col, Math.min(level + 1, 8));
    }

    animateMerge(connected, targetRow, targetCol, newLevel) {
        const { x: tx, y: ty } = this.getCellPos(targetRow, targetCol);
        let done = 0;

        for (const [r, c] of connected) {
            const obj = this.cellObjects[r][c];
            const isTarget = r === targetRow && c === targetCol;
            this.tweens.add({
                targets: [obj.elem, obj.label],
                x: isTarget ? obj.baseX : tx,
                y: isTarget ? obj.baseY : ty,
                scaleX: isTarget ? 1.25 : 0,
                scaleY: isTarget ? 1.25 : 0,
                duration: 180,
                ease: 'Power2',
                onComplete: () => {
                    done++;
                    if (done === connected.length) this.completeMerge(connected, targetRow, targetCol, newLevel);
                },
            });
        }
    }

    completeMerge(connected, targetRow, targetCol, newLevel) {
        for (const [r, c] of connected) this.board[r][c] = 0;
        this.board[targetRow][targetCol] = newLevel;

        this.spawnElements(Math.max(1, Math.floor(connected.length / 2)));
        this.updateGrid();

        const obj = this.cellObjects[targetRow][targetCol];
        this.tweens.add({
            targets: [obj.elem, obj.label],
            scaleX: 1,
            scaleY: 1,
            duration: 120,
            ease: 'Back',
            onComplete: () => {
                this.isAnimating = false;
                if (this.isGameOver()) {
                    this.time.delayedCall(400, () => this.showGameOver());
                }
            },
        });
    }

    spawnElements(count) {
        const empty = [];
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.board[r][c] === 0) empty.push([r, c]);
            }
        }
        Phaser.Utils.Array.Shuffle(empty);
        for (let i = 0; i < Math.min(count, empty.length); i++) {
            const [r, c] = empty[i];
            this.board[r][c] = Phaser.Math.Between(1, 3);
        }
    }

    isGameOver() {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.board[r][c] === 0) return false;
                if (this.findConnected(r, c).length >= 2) return false;
            }
        }
        return true;
    }

    flashCell(row, col) {
        const obj = this.cellObjects[row][col];
        this.tweens.add({
            targets: obj.elem,
            alpha: 0.2,
            duration: 70,
            yoyo: true,
            repeat: 2,
            onComplete: () => obj.elem.setAlpha(this.board[row][col] === 0 ? 0.2 : 1),
        });
    }

    showGameOver() {
        const cx = 360, cy = 540;
        this.add.rectangle(cx, cy, 400, 240, 0x000000, 0.85).setDepth(10);
        this.add.text(cx, cy - 70, 'Игра окончена!', {
            fontSize: '36px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);
        this.add.text(cx, cy - 10, `Очки: ${this.score}`, {
            fontSize: '28px', fill: '#f1c40f', fontFamily: 'Arial',
        }).setOrigin(0.5).setDepth(11);

        const btn = this.add.text(cx, cy + 60, '[ Ещё раз ]', {
            fontSize: '30px', fill: '#2ecc71', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11).setInteractive();

        btn.on('pointerdown', () => this.scene.restart());
    }
}
