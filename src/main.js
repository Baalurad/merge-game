const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1080,
    },
    backgroundColor: '#1a1a2e',
    scene: [GameScene],
};

new Phaser.Game(config);
