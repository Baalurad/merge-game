class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        for (let i = 1; i <= 10; i++) {
            this.load.image(`egg_${i}`, `assets/eggs/egg_${i}.png`);
            this.load.image(`coffee_${i}`, `assets/coffee/coffee_${i}.png`);
            this.load.image(`ruby_${i}`, `assets/ruby-cartoon/ruby_${i}.png`);
            this.load.image(`crystal_${i}`, `assets/crystal-cartoon/crystal_${i}.png`);
        }
        for (let i = 1; i <= 8; i++) {
            this.load.image(`potion_${i}`, `assets/potions/potion_${i}.png`);
        }
        this.load.image('ruby_basket', 'assets/ruby-cartoon/ruby_basket.png');
        this.load.image('crystal_basket', 'assets/crystal-cartoon/crystal_basket.png');
        this.load.image('henhouse_basket', 'assets/eggs/henhouse_basket.png');
        this.load.image('coffee_basket', 'assets/coffee/basket_sack.png');
        this.load.image('cauldron_basket', 'assets/potions/cauldron_basket.png');
    }

    create() {
        this.COLS = 7;
        this.ROWS = 9;
        this.GAP = 8;
        this.PANEL_H = 130;
        this.MAX_CUSTOMERS = 4;

        const cellW = Math.floor((680 - (this.COLS - 1) * this.GAP) / this.COLS);
        const cellH = Math.floor((1140 - (this.ROWS - 1) * this.GAP) / this.ROWS);
        this.CELL_SIZE = Math.min(cellW, cellH, 98);
        this.ELEM_SCALE = (this.CELL_SIZE - 12) / 192;

        const gridW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP;
        const gridH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP;
        this.offsetX = (720 - gridW) / 2;
        this.offsetY = 100 + this.PANEL_H + ((1180 - this.PANEL_H) - gridH) / 2;

        this.BASKET_CONFIGS = [
            {
                color: 0xf39c12,
                labelColor: '#1a1a2e',
                elemTextColor: '#ffffff',
                spritePrefix: 'egg',
                basketSprite: 'henhouse_basket',
                maxLevel: 10,
            },
            {
                color: 0x8e44ad,
                labelColor: '#ffffff',
                elemTextColor: '#000000',
                spritePrefix: 'coffee',
                basketSprite: 'coffee_basket',
                maxLevel: 10,
            },
            {
                color: 0x27ae60,
                labelColor: '#ffffff',
                elemTextColor: '#ffffff',
                spritePrefix: 'potion',
                basketSprite: 'cauldron_basket',
                maxLevel: 8,
            },
            {
                color: 0xc0392b,
                labelColor: '#ffffff',
                elemTextColor: '#ffffff',
                spritePrefix: 'ruby',
                basketSprite: 'ruby_basket',
                maxLevel: 10,
                energyBased: true,
            },
            {
                color: 0x1a6fa8,
                labelColor: '#ffffff',
                elemTextColor: '#ffffff',
                spritePrefix: 'crystal',
                basketSprite: 'crystal_basket',
                maxLevel: 10,
            },
        ];

        this.LABELS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '★'];

        this.customers = [];
        this.slotOccupied = new Array(this.MAX_CUSTOMERS).fill(false);

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('mergeHighScore') || '0');

        this.RUBY_ENERGY_CAP = 60;
        this.RUBY_ENERGY_REGEN_MS = 60000;
        this.loadRubyEnergy();

        this.isAnimating = false;
        this.spawnCooldown = false;

        this.basket2Unlocked = false;
        this.basket3Unlocked = false;
        this.basket4Unlocked = false;
        this.tasksCompleted = 0;

        // Drag state (shared between elements and baskets)
        this.dragSrc = null;      // { row, col, isBasket }
        this.dragVisual = null;
        this.dragLabelVisual = null;

        // Basket interaction state (movement-based: move >20px = drag, release = spawn)
        this.basketPressSrc = null;
        this.lastPointerPos = { x: 0, y: 0 };

        // board[r][c] = { level, type }
        // level: -1 = basket, 0 = empty, 1-8 = element
        // type: basket index (0, 1, ...) or null for empty
        this.board = [];
        this.initBoard();
        this.createUI();
        this.createCustomerPanel();
        this.createGrid();
        this.updateGrid();

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.startCustomerSpawner();
        this.startEnergyRegen();
        window.addEventListener('pagehide', () => this.saveRubyEnergy());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveRubyEnergy(); });
    }

    initBoard() {
        for (let r = 0; r < this.ROWS; r++) {
            this.board[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.board[r][c] = { level: 0, type: null };
            }
        }
        this.board[4][3] = { level: -1, type: 0 };
        this.board[4][4] = { level: -1, type: 3 };
    }

    createUI() {
        this.add.rectangle(360, 50, 720, 100, 0x16213e);
        this.scoreText = this.add.text(24, 28, 'Score: 0', {
            fontSize: '28px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        });
        this.highScoreText = this.add.text(696, 28, `Best: ${this.highScore}`, {
            fontSize: '22px', fill: '#aaaaaa', fontFamily: 'Arial',
        }).setOrigin(1, 0);
        this.energyText = this.add.text(360, 64, '', {
            fontSize: '20px', fill: '#f1c40f', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        this.energyPlusBtn = this.add.text(0, 72, '+', {
            fontSize: '24px', fill: '#e74c3c', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0, 0.5).setInteractive()
            .on('pointerdown', () => this.showEnergyPopup());
        this.updateEnergyDisplay();
        this.add.text(720, 1276, `v${APP_VERSION}`, {
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

                // basketRect: shown for basket and empty cells (colored rectangle)
                const basketRect = this.add.rectangle(x, y, s - 12, s - 12, 0x0f3460)
                    .setAlpha(0.2);

                // elem: sprite image shown for level 1-8 elements
                const elem = this.add.image(x, y, 'egg_1')
                    .setScale(this.ELEM_SCALE)
                    .setVisible(false);

                const label = this.add.text(x, y, '', this.levelLabelStyle(Math.floor(s * 0.35)))
                    .setOrigin(0, 1);

                this.cellObjects[r][c] = { bg, basketRect, elem, label, baseX: x, baseY: y };
            }
        }
    }

    getCellPos(row, col) {
        return {
            x: this.offsetX + col * (this.CELL_SIZE + this.GAP) + this.CELL_SIZE / 2,
            y: this.offsetY + row * (this.CELL_SIZE + this.GAP) + this.CELL_SIZE / 2,
        };
    }

    // Единый стиль цифры уровня — менять только здесь
    levelLabelStyle(fontSize) {
        return { fontSize: `${fontSize}px`, fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold' };
    }

    // Позиционирует лейбл в левый нижний угол спрайта по его центру и размеру
    placeLevelLabel(label, cx, cy, spriteSize) {
        return label.setOrigin(0, 1).setPosition(cx - spriteSize / 2 + 4, cy + spriteSize / 2 - 4);
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
            obj.basketRect.setVisible(false);
            if (cfg.basketSprite) {
                obj.elem.setTexture(cfg.basketSprite)
                    .setScale(this.ELEM_SCALE)
                    .setPosition(obj.baseX, obj.baseY)
                    .setAlpha(1).setVisible(true);
            } else {
                obj.basketRect.setFillStyle(cfg.color).setAlpha(1)
                    .setPosition(obj.baseX, obj.baseY).setScale(1).setVisible(true);
                obj.elem.setVisible(false);
            }
            obj.label.setText('').setPosition(obj.baseX, obj.baseY).setScale(1).setAlpha(1);
        } else if (level === 0) {
            obj.bg.setStrokeStyle(2, 0x0f3460);
            obj.basketRect.setFillStyle(0x0f3460).setAlpha(0.2)
                .setPosition(obj.baseX, obj.baseY).setScale(1).setVisible(true);
            obj.elem.setVisible(false);
            obj.label.setText('').setPosition(obj.baseX, obj.baseY).setScale(1).setAlpha(1);
        } else {
            const cfg = this.BASKET_CONFIGS[type];
            obj.bg.setStrokeStyle(2, 0x0f3460);
            obj.basketRect.setVisible(false);
            obj.elem.setTexture(`${cfg.spritePrefix}_${level}`)
                .setScale(this.ELEM_SCALE)
                .setPosition(obj.baseX, obj.baseY)
                .setAlpha(1).setVisible(true);
            this.placeLevelLabel(obj.label, obj.baseX, obj.baseY, this.CELL_SIZE)
                .setText(this.LABELS[level]).setScale(1).setAlpha(1);
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
            this.basketPressSrc = { row, col };
            return;
        }

        if (level > 0) {
            this.startDrag(row, col, pointer, false);
        }
    }

    onPointerMove(pointer) {
        this.lastPointerPos = { x: pointer.x, y: pointer.y };

        if (this.basketPressSrc && !this.dragSrc) {
            if (Math.abs(pointer.x - this.lastPointerPos.x) > 20 || Math.abs(pointer.y - this.lastPointerPos.y) > 20) {
                const { row, col } = this.basketPressSrc;
                this.basketPressSrc = null;
                this.startDrag(row, col, pointer, true);
            }
        }

        if (!this.dragSrc) return;
        this.dragVisual.setPosition(pointer.x, pointer.y);
        this.dragLabelVisual.setPosition(pointer.x, pointer.y);
    }

    onPointerUp(pointer) {
        if (this.basketPressSrc) {
            const src = this.basketPressSrc;
            this.basketPressSrc = null;
            this.spawnFromBasket(src.row, src.col);
            return;
        }

        if (!this.dragSrc) return;
        const cell = this.pointerToCell(pointer);
        this.endDrag(cell, pointer);
    }

    // ── DRAG ──────────────────────────────────────────────

    startDrag(row, col, pointer, isBasket) {
        this.dragSrc = { row, col, isBasket };
        const { level, type } = this.board[row][col];
        const cfg = this.BASKET_CONFIGS[type];
        const labelText = isBasket ? '+1' : this.LABELS[level];
        const labelColor = isBasket ? cfg.labelColor : cfg.elemTextColor;

        if (isBasket) {
            this.dragVisual = this.add.image(pointer.x, pointer.y, cfg.basketSprite)
                .setScale(this.ELEM_SCALE)
                .setDepth(20).setAlpha(0.9);
        } else {
            this.dragVisual = this.add.image(pointer.x, pointer.y, `${cfg.spritePrefix}_${level}`)
                .setScale(this.ELEM_SCALE)
                .setDepth(20).setAlpha(0.9);
        }

        this.dragLabelVisual = this.add.text(pointer.x, pointer.y, labelText, {
            fontSize: `${Math.floor(this.CELL_SIZE * 0.35)}px`,
            fill: labelColor, fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(21);

        const obj = this.cellObjects[row][col];
        obj.elem.setAlpha(0.2);
        obj.label.setAlpha(0.2);
    }

    endDrag(targetCell, pointer) {
        const src = this.dragSrc;
        this.dragSrc = null;
        this.dragVisual.destroy();      this.dragVisual = null;
        this.dragLabelVisual.destroy(); this.dragLabelVisual = null;

        const srcObj = this.cellObjects[src.row][src.col];
        srcObj.elem.setAlpha(1);
        srcObj.label.setAlpha(1);

        if (!targetCell) {
            if (pointer && !src.isBasket) {
                const ci = this.pointerToCustomerIndex(pointer.x, pointer.y);
                if (ci >= 0) {
                    const cust = this.customers[ci];
                    const srcCell = this.board[src.row][src.col];
                    if (srcCell.level === cust.level && srcCell.type === cust.type) {
                        this.fulfillOrder(ci, src.row, src.col);
                    }
                }
            }
            return;
        }
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
        const srcCell = this.board[srcRow][srcCol];

        if (!this.basket2Unlocked && srcCell.type === 1 && srcCell.level === 1) {
            this.unlockBasket2(srcRow, srcCol, tgtRow, tgtCol);
            return;
        }
        if (!this.basket3Unlocked && srcCell.type === 2 && srcCell.level === 2) {
            this.unlockBasket3(srcRow, srcCol, tgtRow, tgtCol);
            return;
        }
        if (!this.basket4Unlocked && srcCell.type === 4 && srcCell.level === 1) {
            this.unlockBasket4(srcRow, srcCol, tgtRow, tgtCol);
            return;
        }

        this.isAnimating = true;
        const newLevel = Math.min(srcCell.level + 1, this.BASKET_CONFIGS[srcCell.type].maxLevel);
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
                    targets: tgtObj.elem,
                    scaleX: this.ELEM_SCALE * 1.25, scaleY: this.ELEM_SCALE * 1.25,
                    duration: 120, yoyo: true, ease: 'Back',
                    onComplete: () => {
                        this.isAnimating = false;
                        if (this.isGameOver()) this.time.delayedCall(400, () => this.showGameOver());
                    },
                });
                this.tweens.add({
                    targets: tgtObj.label,
                    scaleX: 1.25, scaleY: 1.25,
                    duration: 120, yoyo: true, ease: 'Back',
                });
            },
        });
    }

    // ── SPAWN ─────────────────────────────────────────────

    spawnFromBasket(basketRow, basketCol) {
        if (this.spawnCooldown) return;
        const { type } = this.board[basketRow][basketCol];

        if (this.BASKET_CONFIGS[type].energyBased) {
            if (this.rubyEnergy <= 0) { this.flashBasket(basketRow, basketCol); return; }
            this.rubyEnergy--;
            this.saveRubyEnergy();
            this.updateEnergyDisplay();
        }

        this.spawnCooldown = true;
        this.time.delayedCall(300, () => { this.spawnCooldown = false; });
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
        const bonusChance = this.BASKET_CONFIGS[type].energyBased ? 0.05 : 0.10;
        const spawnLevel = Math.random() < bonusChance ? 2 : 1;
        this.board[r][c] = { level: spawnLevel, type };
        this.updateCell(r, c);

        const obj = this.cellObjects[r][c];
        obj.elem.setScale(0);
        obj.label.setScale(0);
        this.tweens.add({
            targets: obj.label,
            scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out',
        });
        this.tweens.add({
            targets: obj.elem,
            scaleX: this.ELEM_SCALE, scaleY: this.ELEM_SCALE, duration: 200, ease: 'Back.Out',
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
        if (this.customerSpawner) this.customerSpawner.remove(false);
        for (const c of this.customers) {
            if (c.expiryTimer) c.expiryTimer.remove(false);
            if (c.timerTween) c.timerTween.stop();
        }
        this.input.off('pointerdown', this.onPointerDown, this);
        this.input.off('pointermove', this.onPointerMove, this);
        this.input.off('pointerup', this.onPointerUp, this);

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

    // ── CUSTOMER / ORDER SYSTEM ───────────────────────────

    createCustomerPanel() {
        const py = 100 + this.PANEL_H / 2;
        this.add.rectangle(360, py, 720, this.PANEL_H, 0x0d1926);
        this.add.rectangle(360, 100 + this.PANEL_H, 720, 2, 0x1a3a5c);
        for (let i = 0; i < this.MAX_CUSTOMERS; i++) {
            const sx = this.getSlotX(i);
            this.add.rectangle(sx, py, 148, 110, 0x111e2e).setStrokeStyle(1, 0x1e3a5c);
        }
    }

    getSlotX(slot) {
        const startX = (720 - this.MAX_CUSTOMERS * 160) / 2 + 80;
        return startX + slot * 160;
    }

    startCustomerSpawner() {
        this.spawnCustomer();
        this.customerSpawner = this.time.addEvent({
            delay: 20000,
            callback: this.spawnCustomer,
            callbackScope: this,
            loop: true,
        });
    }

    spawnCustomer() {
        const slot = this.slotOccupied.indexOf(false);
        if (slot === -1) return;

        const types = new Set();
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.board[r][c].level === -1) types.add(this.board[r][c].type);
        if (types.size === 0) return;

        // Max 1 order per energy-based type — exclude types that already have an active order
        for (const c of this.customers) {
            if (this.BASKET_CONFIGS[c.type].energyBased) types.delete(c.type);
        }
        if (types.size === 0) return;

        this.slotOccupied[slot] = true;
        const type = Phaser.Utils.Array.GetRandom([...types]);
        const level = Phaser.Math.Between(2, 4);
        const sx = this.getSlotX(slot);
        const py = 100 + this.PANEL_H / 2;
        const cfg = this.BASKET_CONFIGS[type];
        const EXPIRY = 45000;
        const isEnergyBased = !!cfg.energyBased;

        const cardBg = this.add.rectangle(sx, py, 148, 110, 0x1a2e4a)
            .setStrokeStyle(2, cfg.color).setDepth(2);
        const elemImg = this.add.image(sx, py - 8, `${cfg.spritePrefix}_${level}`)
            .setDisplaySize(74, 74).setDepth(3);
        const levelLabel = this.placeLevelLabel(
            this.add.text(0, 0, this.LABELS[level], this.levelLabelStyle(22)).setDepth(4),
            sx, py - 8, 74
        );
        const timerBarBg = this.add.rectangle(sx, py + 46, 120, 6, 0x0d1926).setDepth(2);
        const timerBarFill = this.add.rectangle(sx - 60, py + 46, 120, 6, 0x27ae60)
            .setOrigin(0, 0.5).setDepth(3);

        const customer = { type, level, slot, objects: [cardBg, elemImg, levelLabel, timerBarBg, timerBarFill] };
        this.customers.push(customer);

        if (isEnergyBased) {
            timerBarBg.setVisible(false);
            timerBarFill.setVisible(false);
        } else {
            customer.timerTween = this.tweens.add({
                targets: timerBarFill, scaleX: 0, duration: EXPIRY, ease: 'Linear',
            });
            customer.expiryTimer = this.time.addEvent({
                delay: EXPIRY,
                callback: () => {
                    const idx = this.customers.indexOf(customer);
                    if (idx >= 0) {
                        this.score -= 50;
                        this.scoreText.setText(`Score: ${this.score}`);
                        this.removeCustomer(idx);
                        if (this.score < 0) {
                            this.time.delayedCall(200, () => this.showGameOver());
                        }
                    }
                },
            });
        }
    }

    removeCustomer(idx) {
        if (idx < 0 || idx >= this.customers.length) return;
        const customer = this.customers[idx];
        if (customer.expiryTimer) customer.expiryTimer.remove(false);
        if (customer.timerTween) customer.timerTween.stop();
        for (const obj of customer.objects) obj.destroy();
        this.slotOccupied[customer.slot] = false;
        this.customers.splice(idx, 1);
        if (this.customers.length === 0) {
            this.time.delayedCall(1000, () => this.spawnCustomer());
        }
    }

    pointerToCustomerIndex(px, py) {
        if (py < 100 || py > 100 + this.PANEL_H) return -1;
        for (let i = 0; i < this.customers.length; i++) {
            const sx = this.getSlotX(this.customers[i].slot);
            if (px >= sx - 74 && px <= sx + 74) return i;
        }
        return -1;
    }

    fulfillOrder(customerIndex, srcRow, srcCol) {
        const cust = this.customers[customerIndex];
        this.score += cust.level * 50;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('mergeHighScore', String(this.highScore));
        }
        this.scoreText.setText(`Score: ${this.score}`);
        this.highScoreText.setText(`Best: ${this.highScore}`);
        this.board[srcRow][srcCol] = { level: 0, type: null };
        this.updateCell(srcRow, srcCol);
        this.removeCustomer(customerIndex);

        if (!this.basket2Unlocked) {
            this.tasksCompleted++;
            if (this.tasksCompleted <= 2) {
                this.time.delayedCall(300, () => this.dropItem(1, 1));
            }
        } else if (!this.basket3Unlocked && cust.type === 1) {
            this.time.delayedCall(300, () => this.dropItem(2, 1));
        } else if (!this.basket4Unlocked && cust.type === 3) {
            this.time.delayedCall(300, () => this.dropItem(4, 1));
        }
    }

    dropItem(type, level) {
        const free = [];
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.board[r][c].level === 0) free.push([r, c]);
            }
        }
        if (free.length === 0) return;
        const [r, c] = Phaser.Utils.Array.GetRandom(free);
        this.board[r][c] = { level, type };
        this.updateCell(r, c);

        const obj = this.cellObjects[r][c];
        obj.elem.setScale(0);
        obj.label.setScale(0);
        this.tweens.add({ targets: obj.elem, scaleX: this.ELEM_SCALE, scaleY: this.ELEM_SCALE, duration: 200, ease: 'Back.Out' });
        this.tweens.add({ targets: obj.label, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out' });
    }

    unlockBasket2(srcRow, srcCol, tgtRow, tgtCol) {
        this.isAnimating = true;
        const { x: tx, y: ty } = this.getCellPos(tgtRow, tgtCol);
        const srcObj = this.cellObjects[srcRow][srcCol];

        this.tweens.add({
            targets: [srcObj.elem, srcObj.label],
            x: tx, y: ty, scaleX: 0, scaleY: 0,
            duration: 160, ease: 'Power2',
            onComplete: () => {
                this.board[srcRow][srcCol] = { level: 0, type: null };
                this.board[tgtRow][tgtCol] = { level: -1, type: 1 };
                this.basket2Unlocked = true;
                this.updateGrid();
                this.isAnimating = false;
            },
        });
    }

    unlockBasket3(srcRow, srcCol, tgtRow, tgtCol) {
        this.isAnimating = true;
        const { x: tx, y: ty } = this.getCellPos(tgtRow, tgtCol);
        const srcObj = this.cellObjects[srcRow][srcCol];

        this.tweens.add({
            targets: [srcObj.elem, srcObj.label],
            x: tx, y: ty, scaleX: 0, scaleY: 0,
            duration: 160, ease: 'Power2',
            onComplete: () => {
                this.board[srcRow][srcCol] = { level: 0, type: null };
                this.board[tgtRow][tgtCol] = { level: -1, type: 2 };
                this.basket3Unlocked = true;
                this.updateGrid();
                this.isAnimating = false;
            },
        });
    }

    unlockBasket4(srcRow, srcCol, tgtRow, tgtCol) {
        this.isAnimating = true;
        const { x: tx, y: ty } = this.getCellPos(tgtRow, tgtCol);
        const srcObj = this.cellObjects[srcRow][srcCol];

        this.tweens.add({
            targets: [srcObj.elem, srcObj.label],
            x: tx, y: ty, scaleX: 0, scaleY: 0,
            duration: 160, ease: 'Power2',
            onComplete: () => {
                this.board[srcRow][srcCol] = { level: 0, type: null };
                this.board[tgtRow][tgtCol] = { level: -1, type: 4 };
                this.basket4Unlocked = true;
                this.updateGrid();
                this.isAnimating = false;
            },
        });
    }

    // ── ENERGY POPUP ──────────────────────────────────────

    showEnergyPopup() {
        const cx = 360, cy = 560;
        const popupObjs = [];
        const track = obj => { popupObjs.push(obj); return obj; };

        const closePopup = () => { for (const o of popupObjs) o.destroy(); };

        track(this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.65).setDepth(30).setInteractive());

        const card = track(this.add.rectangle(cx, cy, 520, 460, 0x1a2e4a)
            .setStrokeStyle(2, 0xc0392b).setDepth(31).setInteractive());
        card.on('pointerdown', (p, lx, ly, evt) => evt.stopPropagation());

        track(this.add.text(cx, cy - 190, 'Нужно больше энергии?', {
            fontSize: '22px', fill: '#f1c40f', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(32));
        track(this.add.text(cx, cy - 155, 'Спроси создателя!', {
            fontSize: '20px', fill: '#ffffff', fontFamily: 'Arial',
        }).setOrigin(0.5).setDepth(32));

        // 4 digit boxes
        let entered = '';
        const digitTexts = [];
        const digitRects = [];
        for (let i = 0; i < 4; i++) {
            const dx = cx - 105 + i * 70;
            const dy = cy - 88;
            digitRects.push(track(this.add.rectangle(dx, dy, 54, 64, 0x0d1926)
                .setStrokeStyle(2, 0x3a5a8a).setDepth(32)));
            digitTexts.push(track(this.add.text(dx, dy, '_', {
                fontSize: '30px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(33)));
        }

        const updateDisplay = () => {
            for (let i = 0; i < 4; i++) digitTexts[i].setText(i < entered.length ? entered[i] : '_');
        };

        const pin = APP_VERSION.replace(/\./g, '').padStart(4, '0');

        const tryConfirm = () => {
            if (entered === pin) {
                this.rubyEnergy = Math.min(this.RUBY_ENERGY_CAP, this.rubyEnergy + 30);
                this.saveRubyEnergy();
                this.updateEnergyDisplay();
                closePopup();
            } else {
                entered = '';
                updateDisplay();
                this.tweens.add({
                    targets: [...digitRects, ...digitTexts],
                    x: '+=8', duration: 45, yoyo: true, repeat: 3, ease: 'Linear',
                });
            }
        };

        // Numpad
        const labels = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];
        labels.forEach((label, idx) => {
            const col = idx % 3, row = Math.floor(idx / 3);
            const bx = cx - 110 + col * 110;
            const by = cy - 10 + row * 72;
            const btn = track(this.add.rectangle(bx, by, 96, 60, 0x0f3460)
                .setStrokeStyle(1, 0x1a5080).setDepth(32).setInteractive());
            track(this.add.text(bx, by, label, {
                fontSize: '26px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(33));
            btn.on('pointerover', () => btn.setFillStyle(0x1a4080));
            btn.on('pointerout', () => btn.setFillStyle(0x0f3460));
            btn.on('pointerdown', () => {
                if (label === '⌫') { entered = entered.slice(0, -1); updateDisplay(); }
                else if (label === '✓') { if (entered.length === 4) tryConfirm(); }
                else if (entered.length < 4) { entered += label; updateDisplay(); if (entered.length === 4) tryConfirm(); }
            });
        });

        // Close button
        track(this.add.text(cx + 235, cy - 210, '✕', {
            fontSize: '26px', fill: '#888888', fontFamily: 'Arial',
        }).setOrigin(0.5).setDepth(33).setInteractive())
            .on('pointerdown', closePopup);
    }

    // ── RUBY ENERGY ───────────────────────────────────────

    updateEnergyDisplay() {
        this.energyText.setText(`Energy: ${this.rubyEnergy} / ${this.RUBY_ENERGY_CAP}`);
        if (this.energyPlusBtn) {
            this.energyPlusBtn.setX(360 + this.energyText.width / 2 + 6);
        }
    }

    loadRubyEnergy() {
        const saved = parseInt(localStorage.getItem('rubyEnergy') ?? '30');
        const lastSeen = parseInt(localStorage.getItem('rubyLastSeen') || String(Date.now()));
        const earned = Math.floor((Date.now() - lastSeen) / this.RUBY_ENERGY_REGEN_MS);
        this.rubyEnergy = Math.min(this.RUBY_ENERGY_CAP, saved + earned);
    }

    saveRubyEnergy() {
        localStorage.setItem('rubyEnergy', String(this.rubyEnergy));
        localStorage.setItem('rubyLastSeen', String(Date.now()));
    }

    startEnergyRegen() {
        this.time.addEvent({
            delay: this.RUBY_ENERGY_REGEN_MS,
            callback: () => {
                if (this.rubyEnergy < this.RUBY_ENERGY_CAP) {
                    this.rubyEnergy++;
                    this.saveRubyEnergy();
                    this.updateEnergyDisplay();
                }
            },
            loop: true,
        });
    }
}
