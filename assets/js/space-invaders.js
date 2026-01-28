/**
 * Space Invaders Easter Egg - RAC Edition
 * Self-contained module that doesn't interfere with main site
 */
(function() {
    'use strict';

    // ===== AUDIO ENGINE =====
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.initialized = false;
        }

        init() {
            if (this.initialized) return;
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        }

        playTone(frequency, duration, type = 'square', volume = 0.3) {
            if (!this.ctx) return;
            const oscillator = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.ctx.currentTime);
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            oscillator.start(this.ctx.currentTime);
            oscillator.stop(this.ctx.currentTime + duration);
        }

        shoot() {
            this.playTone(800, 0.1, 'square', 0.15);
            setTimeout(() => this.playTone(600, 0.05, 'square', 0.1), 50);
        }

        explosion() {
            if (!this.ctx) return;
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            
            const noise = this.ctx.createBufferSource();
            const gainNode = this.ctx.createGain();
            noise.buffer = buffer;
            noise.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            gainNode.gain.setValueAtTime(0.25, this.ctx.currentTime);
            noise.start();
        }

        playerHit() {
            this.playTone(200, 0.3, 'sawtooth', 0.3);
            setTimeout(() => this.playTone(100, 0.3, 'sawtooth', 0.2), 100);
        }

        invaderMove() {
            this.playTone(80 + Math.random() * 40, 0.05, 'square', 0.08);
        }

        gameOver() {
            const notes = [400, 350, 300, 250, 200];
            notes.forEach((freq, i) => {
                setTimeout(() => this.playTone(freq, 0.3, 'square', 0.25), i * 200);
            });
        }

        levelUp() {
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                setTimeout(() => this.playTone(freq, 0.15, 'square', 0.2), i * 100);
            });
        }

        rocketLaunch() {
            if (!this.ctx) return;
            const oscillator = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, this.ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 1);
            
            gainNode.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);
            
            oscillator.start(this.ctx.currentTime);
            oscillator.stop(this.ctx.currentTime + 1);
        }
    }

    // ===== GAME CLASS =====
    class SpaceInvadersGame {
        constructor() {
            this.audio = new AudioEngine();
            this.canvas = null;
            this.ctx = null;
            this.gameRunning = false;
            this.score = 0;
            this.lives = 3;
            this.hiScore = parseInt(localStorage.getItem('racInvadersHiScore')) || 0;
            this.level = 1;
            
            this.CANVAS_WIDTH = 600;
            this.CANVAS_HEIGHT = 500;
            this.SCALE = 1;
            
            this.player = {
                x: 0,
                y: 0,
                width: 40,
                height: 40,
                speed: 8 // Base speed, modified by sensitivity
            };
            
            this.sensitivity = 1.0; // Multiplier from slider (0.5 to 2.0)
            
            this.playerBullets = [];
            this.invaderBullets = [];
            this.invaders = [];
            
            this.BULLET_SPEED = 7;
            this.PLAYER_FIRE_RATE = 250;
            this.lastFireTime = 0;
            
            this.invaderDirection = 1;
            this.invaderMoveTimer = 0;
            this.invaderMoveInterval = 300; // For sprite animation only
            this.invaderDropAmount = 20;
            this.invaderSpeed = 0.8; // Smooth movement speed (pixels per frame at scale 1)
            
            this.keys = { left: false, right: false, fire: false };
            this.lastTime = 0;
            
            // Load player ship image
            this.playerShipImg = new Image();
            this.playerShipImg.src = 'images/RAC-Arrow_3.webp';
            this.shipImageLoaded = false;
            this.playerShipImg.onload = () => { this.shipImageLoaded = true; };
            
            // Invader sprites
            this.INVADER_SPRITES = {
                squid: [
                    [0,0,0,1,1,0,0,0],
                    [0,0,1,1,1,1,0,0],
                    [0,1,1,1,1,1,1,0],
                    [1,1,0,1,1,0,1,1],
                    [1,1,1,1,1,1,1,1],
                    [0,0,1,0,0,1,0,0],
                    [0,1,0,1,1,0,1,0],
                    [1,0,1,0,0,1,0,1]
                ],
                squid2: [
                    [0,0,0,1,1,0,0,0],
                    [0,0,1,1,1,1,0,0],
                    [0,1,1,1,1,1,1,0],
                    [1,1,0,1,1,0,1,1],
                    [1,1,1,1,1,1,1,1],
                    [0,1,0,1,1,0,1,0],
                    [1,0,0,0,0,0,0,1],
                    [0,1,0,0,0,0,1,0]
                ],
                crab: [
                    [0,0,1,0,0,0,0,0,1,0,0],
                    [0,0,0,1,0,0,0,1,0,0,0],
                    [0,0,1,1,1,1,1,1,1,0,0],
                    [0,1,1,0,1,1,1,0,1,1,0],
                    [1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,1,1,1,1,1,1,1,0,1],
                    [1,0,1,0,0,0,0,0,1,0,1],
                    [0,0,0,1,1,0,1,1,0,0,0]
                ],
                crab2: [
                    [0,0,1,0,0,0,0,0,1,0,0],
                    [1,0,0,1,0,0,0,1,0,0,1],
                    [1,0,1,1,1,1,1,1,1,0,1],
                    [1,1,1,0,1,1,1,0,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1],
                    [0,1,1,1,1,1,1,1,1,1,0],
                    [0,0,1,0,0,0,0,0,1,0,0],
                    [0,1,0,0,0,0,0,0,0,1,0]
                ],
                octopus: [
                    [0,0,0,0,1,1,1,1,0,0,0,0],
                    [0,1,1,1,1,1,1,1,1,1,1,0],
                    [1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,0,0,1,1,0,0,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1],
                    [0,0,0,1,1,0,0,1,1,0,0,0],
                    [0,0,1,1,0,1,1,0,1,1,0,0],
                    [1,1,0,0,0,0,0,0,0,0,1,1]
                ],
                octopus2: [
                    [0,0,0,0,1,1,1,1,0,0,0,0],
                    [0,1,1,1,1,1,1,1,1,1,1,0],
                    [1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,0,0,1,1,0,0,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1],
                    [0,0,1,1,1,0,0,1,1,1,0,0],
                    [0,1,1,0,0,1,1,0,0,1,1,0],
                    [0,0,1,1,0,0,0,0,1,1,0,0]
                ]
            };
            
            this.INVADER_COLORS = [
                'rgba(255, 255, 255, 0.9)',
                'rgba(255, 255, 255, 0.8)',
                'rgba(255, 255, 255, 0.7)',
                'rgba(255, 255, 255, 0.65)',
                'rgba(255, 255, 255, 0.6)'
            ];

            // RAC letter pattern for level 1 (19 columns x 5 rows)
            this.RAC_PATTERN = [
                [1,1,1,1,0, 0,0, 0,1,1,1,0, 0,0, 0,1,1,1,1],
                [1,0,0,0,1, 0,0, 1,0,0,0,1, 0,0, 1,0,0,0,0],
                [1,1,1,1,0, 0,0, 1,1,1,1,1, 0,0, 1,0,0,0,0],
                [1,0,0,1,0, 0,0, 1,0,0,0,1, 0,0, 1,0,0,0,0],
                [1,0,0,0,1, 0,0, 1,0,0,0,1, 0,0, 0,1,1,1,1]
            ];
        }

        init() {
            this.canvas = document.getElementById('si-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.setupControls();
            this.updateHiScoreDisplay();
        }

        resizeCanvas() {
            const maxWidth = Math.min(window.innerWidth - 40, 600);
            const maxHeight = Math.min(window.innerHeight - 200, 500);
            const aspectRatio = 600 / 500;
            
            if (maxWidth / maxHeight > aspectRatio) {
                this.CANVAS_HEIGHT = maxHeight;
                this.CANVAS_WIDTH = maxHeight * aspectRatio;
            } else {
                this.CANVAS_WIDTH = maxWidth;
                this.CANVAS_HEIGHT = maxWidth / aspectRatio;
            }
            
            this.SCALE = this.CANVAS_WIDTH / 600;
            
            this.canvas.width = this.CANVAS_WIDTH;
            this.canvas.height = this.CANVAS_HEIGHT;
            this.canvas.style.width = this.CANVAS_WIDTH + 'px';
            this.canvas.style.height = this.CANVAS_HEIGHT + 'px';
        }

        setupControls() {
            // Keyboard
            document.addEventListener('keydown', (e) => {
                if (!document.getElementById('si-game-container').classList.contains('si-active')) return;
                
                if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
                if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
                if (e.key === ' ') {
                    e.preventDefault();
                    this.keys.fire = true;
                }
                if (e.key === 'Escape') this.exitGame();
            });

            document.addEventListener('keyup', (e) => {
                if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
                if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
                if (e.key === ' ') this.keys.fire = false;
            });

            // Mobile controls
            const btnLeft = document.getElementById('si-btn-left');
            const btnRight = document.getElementById('si-btn-right');
            const btnFire = document.getElementById('si-btn-fire');

            if (btnLeft) {
                btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.left = true; });
                btnLeft.addEventListener('touchend', () => this.keys.left = false);
            }
            if (btnRight) {
                btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.right = true; });
                btnRight.addEventListener('touchend', () => this.keys.right = false);
            }
            if (btnFire) {
                btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.fire = true; });
                btnFire.addEventListener('touchend', () => this.keys.fire = false);
            }

            // Start button
            const startBtn = document.getElementById('si-start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => this.startGame());
            }

            // Sensitivity slider
            const sensitivitySlider = document.getElementById('si-sensitivity-slider');
            const sensitivityValue = document.getElementById('si-sensitivity-value');
            if (sensitivitySlider) {
                // Load saved sensitivity
                const savedSensitivity = localStorage.getItem('racInvadersSensitivity');
                if (savedSensitivity) {
                    this.sensitivity = parseFloat(savedSensitivity);
                    sensitivitySlider.value = this.sensitivity;
                    if (sensitivityValue) sensitivityValue.textContent = this.sensitivity.toFixed(1) + 'x';
                }

                sensitivitySlider.addEventListener('input', (e) => {
                    this.sensitivity = parseFloat(e.target.value);
                    if (sensitivityValue) sensitivityValue.textContent = this.sensitivity.toFixed(1) + 'x';
                    localStorage.setItem('racInvadersSensitivity', this.sensitivity);
                });
            }
        }

        updateHiScoreDisplay() {
            const el = document.getElementById('si-hi-score');
            if (el) el.textContent = this.hiScore;
        }

        createInvaders() {
            this.invaders = [];
            
            // Use RAC pattern for level 1, standard grid for other levels
            if (this.level === 1) {
                this.createRACFormation();
            } else {
                this.createStandardFormation();
            }
        }

        createRACFormation() {
            const pattern = this.RAC_PATTERN;
            const cols = pattern[0].length;
            const rows = pattern.length;
            
            // Center the pattern with tighter spacing to fit and leave room for movement
            const spacingX = 25 * this.SCALE;
            const spacingY = 35 * this.SCALE;
            const totalWidth = cols * spacingX;
            const startX = (this.CANVAS_WIDTH - totalWidth) / 2 + 20 * this.SCALE; // Extra margin
            const startY = 50 * this.SCALE;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (pattern[row][col] === 1) {
                        let type, width, points;
                        if (row === 0) {
                            type = 'squid';
                            width = 8;
                            points = 30;
                        } else if (row < 3) {
                            type = 'crab';
                            width = 11;
                            points = 20;
                        } else {
                            type = 'octopus';
                            width = 12;
                            points = 10;
                        }

                        this.invaders.push({
                            x: startX + col * spacingX,
                            y: startY + row * spacingY,
                            type: type,
                            width: width,
                            height: 8,
                            alive: true,
                            frame: 0,
                            color: this.INVADER_COLORS[row],
                            points: points
                        });
                    }
                }
            }
        }

        createStandardFormation() {
            const startX = 50 * this.SCALE;
            const startY = 60 * this.SCALE;
            const spacingX = 45 * this.SCALE;
            const spacingY = 40 * this.SCALE;

            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 11; col++) {
                    let type, width, points;
                    if (row === 0) {
                        type = 'squid';
                        width = 8;
                        points = 30;
                    } else if (row < 3) {
                        type = 'crab';
                        width = 11;
                        points = 20;
                    } else {
                        type = 'octopus';
                        width = 12;
                        points = 10;
                    }

                    this.invaders.push({
                        x: startX + col * spacingX,
                        y: startY + row * spacingY,
                        type: type,
                        width: width,
                        height: 8,
                        alive: true,
                        frame: 0,
                        color: this.INVADER_COLORS[row],
                        points: points
                    });
                }
            }
        }

        drawPlayer() {
            const s = this.SCALE;
            const shipWidth = this.player.width * s;
            const shipHeight = this.player.height * s;
            
            this.ctx.save();
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
            this.ctx.shadowBlur = 15 * s;
            
            if (this.shipImageLoaded) {
                this.ctx.drawImage(
                    this.playerShipImg,
                    this.player.x,
                    this.player.y,
                    shipWidth,
                    shipHeight
                );
            } else {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.beginPath();
                this.ctx.moveTo(this.player.x + shipWidth / 2, this.player.y);
                this.ctx.lineTo(this.player.x + shipWidth, this.player.y + shipHeight);
                this.ctx.lineTo(this.player.x, this.player.y + shipHeight);
                this.ctx.closePath();
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }

        drawSprite(sprite, x, y, pixelSize, color) {
            this.ctx.fillStyle = color;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 3;
            
            for (let row = 0; row < sprite.length; row++) {
                for (let col = 0; col < sprite[row].length; col++) {
                    if (sprite[row][col]) {
                        this.ctx.fillRect(
                            x + col * pixelSize,
                            y + row * pixelSize,
                            pixelSize - 1,
                            pixelSize - 1
                        );
                    }
                }
            }
            this.ctx.shadowBlur = 0;
        }

        drawInvaders() {
            const pixelSize = 3 * this.SCALE;
            
            this.invaders.forEach(inv => {
                if (!inv.alive) return;
                
                let sprite;
                if (inv.type === 'squid') {
                    sprite = inv.frame === 0 ? this.INVADER_SPRITES.squid : this.INVADER_SPRITES.squid2;
                } else if (inv.type === 'crab') {
                    sprite = inv.frame === 0 ? this.INVADER_SPRITES.crab : this.INVADER_SPRITES.crab2;
                } else {
                    sprite = inv.frame === 0 ? this.INVADER_SPRITES.octopus : this.INVADER_SPRITES.octopus2;
                }
                
                this.drawSprite(sprite, inv.x, inv.y, pixelSize, inv.color);
            });
        }

        updateInvaders(deltaTime) {
            const aliveInvaders = this.invaders.filter(i => i.alive);
            if (aliveInvaders.length === 0) return;

            // Sprite animation timer (keeps classic look)
            this.invaderMoveTimer += deltaTime;
            if (this.invaderMoveTimer >= this.invaderMoveInterval) {
                this.invaderMoveTimer = 0;
                this.invaders.forEach(inv => {
                    if (inv.alive) inv.frame = inv.frame === 0 ? 1 : 0;
                });
                this.audio.invaderMove();
                
                // Random shooting on animation tick
                if (Math.random() < 0.3) {
                    const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
                    this.invaderBullets.push({
                        x: shooter.x + (shooter.width * 3 * this.SCALE) / 2,
                        y: shooter.y + shooter.height * 3 * this.SCALE,
                        width: 3 * this.SCALE,
                        height: 10 * this.SCALE
                    });
                }
            }

            // Smooth movement every frame
            const moveAmount = this.invaderSpeed * this.SCALE * this.invaderDirection;
            
            // Check if any invader would hit the edge
            let hitEdge = false;
            aliveInvaders.forEach(inv => {
                const futureX = inv.x + moveAmount;
                const invWidth = inv.width * 3 * this.SCALE;
                if (futureX + invWidth > this.CANVAS_WIDTH - 10 || futureX < 10) {
                    hitEdge = true;
                }
            });

            if (hitEdge) {
                // Reverse direction and drop down
                this.invaderDirection *= -1;
                aliveInvaders.forEach(inv => {
                    inv.y += this.invaderDropAmount * this.SCALE;
                });
                
                // Speed up slightly as invaders are destroyed
                const speedBoost = 1 + (55 - aliveInvaders.length) * 0.015;
                this.invaderSpeed = 0.8 * speedBoost;
                
                // Check if invaders reached player
                const lowestInvader = Math.max(...aliveInvaders.map(i => i.y + i.height * 3 * this.SCALE));
                if (lowestInvader >= this.player.y) {
                    this.gameOver();
                    return;
                }
            } else {
                // Smooth horizontal movement
                aliveInvaders.forEach(inv => {
                    inv.x += moveAmount;
                });
            }
        }

        firePlayerBullet() {
            const now = Date.now();
            if (now - this.lastFireTime < this.PLAYER_FIRE_RATE) return;
            
            this.lastFireTime = now;
            this.playerBullets.push({
                x: this.player.x + (this.player.width * this.SCALE) / 2 - 2 * this.SCALE,
                y: this.player.y,
                width: 4 * this.SCALE,
                height: 15 * this.SCALE
            });
            this.audio.shoot();
        }

        updateBullets() {
            this.playerBullets = this.playerBullets.filter(bullet => {
                bullet.y -= this.BULLET_SPEED * this.SCALE;
                return bullet.y > 0;
            });

            this.invaderBullets = this.invaderBullets.filter(bullet => {
                bullet.y += this.BULLET_SPEED * 0.6 * this.SCALE;
                return bullet.y < this.CANVAS_HEIGHT;
            });
        }

        drawBullets() {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            this.ctx.shadowBlur = 8 * this.SCALE;
            this.playerBullets.forEach(bullet => {
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            });

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            this.invaderBullets.forEach(bullet => {
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            });
            
            this.ctx.shadowBlur = 0;
        }

        checkCollisions() {
            const pixelSize = 3 * this.SCALE;
            
            this.playerBullets = this.playerBullets.filter(bullet => {
                let hit = false;
                this.invaders.forEach(inv => {
                    if (!inv.alive || hit) return;
                    
                    const invWidth = inv.width * pixelSize;
                    const invHeight = inv.height * pixelSize;
                    
                    if (bullet.x < inv.x + invWidth &&
                        bullet.x + bullet.width > inv.x &&
                        bullet.y < inv.y + invHeight &&
                        bullet.y + bullet.height > inv.y) {
                        
                        inv.alive = false;
                        hit = true;
                        this.score += inv.points;
                        document.getElementById('si-score').textContent = this.score;
                        this.audio.explosion();
                        
                        if (this.invaders.every(i => !i.alive)) {
                            this.levelUp();
                        }
                    }
                });
                return !hit;
            });

            this.invaderBullets = this.invaderBullets.filter(bullet => {
                if (bullet.x < this.player.x + this.player.width * this.SCALE &&
                    bullet.x + bullet.width > this.player.x &&
                    bullet.y < this.player.y + this.player.height * this.SCALE &&
                    bullet.y + bullet.height > this.player.y) {
                    
                    this.lives--;
                    document.getElementById('si-lives').textContent = this.lives;
                    this.audio.playerHit();
                    
                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                    return false;
                }
                return true;
            });
        }

        levelUp() {
            this.level++;
            this.audio.levelUp();
            this.invaderMoveInterval = Math.max(150, 300 - this.level * 20);
            this.invaderSpeed = 0.8 + this.level * 0.2; // Faster each level
            this.createInvaders();
        }

        gameOver() {
            this.gameRunning = false;
            this.audio.gameOver();
            
            if (this.score > this.hiScore) {
                this.hiScore = this.score;
                localStorage.setItem('racInvadersHiScore', this.hiScore);
                document.getElementById('si-hi-score').textContent = this.hiScore;
            }
            
            document.getElementById('si-overlay-title').textContent = 'GAME OVER';
            document.getElementById('si-final-score').textContent = `Final Score: ${this.score}`;
            document.getElementById('si-final-score').style.display = 'block';
            document.getElementById('si-instructions').style.display = 'none';
            document.getElementById('si-slider-container').style.display = 'none';
            document.getElementById('si-start-btn').textContent = 'PLAY AGAIN';
            document.getElementById('si-overlay').classList.remove('si-hidden');
        }

        exitGame() {
            this.gameRunning = false;
            
            // Hide game container
            document.getElementById('si-game-container').classList.remove('si-active');
            
            // Show wrapper again
            setTimeout(() => {
                document.getElementById('wrapper').classList.remove('si-slide-down');
                this.resetGame();
            }, 200);
        }

        resetGame() {
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.invaderMoveInterval = 300;
            this.invaderSpeed = 0.8;
            this.invaderDirection = 1;
            this.playerBullets = [];
            this.invaderBullets = [];
            
            document.getElementById('si-score').textContent = '0';
            document.getElementById('si-lives').textContent = '3';
            document.getElementById('si-overlay-title').textContent = 'SPACE INVADERS';
            document.getElementById('si-final-score').style.display = 'none';
            document.getElementById('si-instructions').style.display = 'block';
            document.getElementById('si-slider-container').style.display = 'block';
            document.getElementById('si-start-btn').textContent = 'START GAME';
            document.getElementById('si-overlay').classList.remove('si-hidden');
        }

        startGame() {
            this.audio.init();
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.invaderMoveInterval = 300;
            this.invaderSpeed = 0.8;
            this.invaderDirection = 1;
            this.playerBullets = [];
            this.invaderBullets = [];
            
            document.getElementById('si-score').textContent = '0';
            document.getElementById('si-lives').textContent = '3';
            
            this.player.x = this.CANVAS_WIDTH / 2 - (this.player.width * this.SCALE) / 2;
            this.player.y = this.CANVAS_HEIGHT - 60 * this.SCALE;
            
            this.createInvaders();
            document.getElementById('si-overlay').classList.add('si-hidden');
            this.gameRunning = true;
            this.lastTime = performance.now();
            this.gameLoop();
        }

        gameLoop(currentTime = 0) {
            if (!this.gameRunning) return;
            
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            this.ctx.fillStyle = 'rgba(27, 31, 34, 0.95)';
            this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

            const moveSpeed = this.player.speed * this.sensitivity * this.SCALE;
            if (this.keys.left && this.player.x > 0) {
                this.player.x -= moveSpeed;
            }
            if (this.keys.right && this.player.x < this.CANVAS_WIDTH - this.player.width * this.SCALE) {
                this.player.x += moveSpeed;
            }
            if (this.keys.fire) {
                this.firePlayerBullet();
            }

            this.updateInvaders(deltaTime);
            this.updateBullets();
            this.checkCollisions();

            this.drawInvaders();
            this.drawBullets();
            this.drawPlayer();

            requestAnimationFrame((t) => this.gameLoop(t));
        }

        show() {
            this.resizeCanvas();
            this.player.x = this.CANVAS_WIDTH / 2 - (this.player.width * this.SCALE) / 2;
            this.player.y = this.CANVAS_HEIGHT - 60 * this.SCALE;
            this.createInvaders();
            
            // Clear canvas
            this.ctx.fillStyle = 'rgba(27, 31, 34, 1)';
            this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        }
    }

    // ===== EASTER EGG TRIGGER =====
    class EasterEggTrigger {
        constructor(game) {
            this.game = game;
            this.holdTimer = null;
            this.holdStartTime = null;
            this.holdProgress = 0;
            this.HOLD_DURATION = 5000; // 5 seconds
            this.circumference = 2 * Math.PI * 65;
            this.audio = new AudioEngine();
            this.countdownRing = null;
            this.progressCircle = null;
        }

        init() {
            // Find the logo element in the header
            const logoContainer = document.querySelector('#header .logo');
            if (!logoContainer) {
                console.warn('Space Invaders: Logo element not found');
                return;
            }

            // Make it interactive
            logoContainer.style.cursor = 'pointer';
            logoContainer.style.userSelect = 'none';
            logoContainer.style.webkitUserSelect = 'none';
            logoContainer.style.position = 'relative';

            // Add countdown ring
            this.countdownRing = document.createElement('div');
            this.countdownRing.className = 'si-countdown-ring';
            this.countdownRing.innerHTML = `
                <svg viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="65"></circle>
                </svg>
            `;
            logoContainer.appendChild(this.countdownRing);
            this.progressCircle = this.countdownRing.querySelector('circle');

            // Event listeners
            logoContainer.addEventListener('mousedown', (e) => this.startHold(e));
            logoContainer.addEventListener('touchstart', (e) => this.startHold(e), { passive: false });
            
            document.addEventListener('mouseup', () => this.endHold());
            document.addEventListener('touchend', () => this.endHold());
            document.addEventListener('mouseleave', () => this.endHold());
        }

        startHold(e) {
            e.preventDefault();
            this.audio.init();
            this.holdStartTime = Date.now();
            
            const logoContainer = document.querySelector('#header .logo');
            logoContainer.classList.add('si-logo-shaking');
            this.countdownRing.classList.add('si-visible');
            
            this.updateProgress();
        }

        updateProgress() {
            if (!this.holdStartTime) return;
            
            const elapsed = Date.now() - this.holdStartTime;
            this.holdProgress = Math.min(elapsed / this.HOLD_DURATION, 1);
            
            const offset = this.circumference * (1 - this.holdProgress);
            this.progressCircle.style.strokeDashoffset = offset;
            
            if (this.holdProgress >= 1) {
                this.triggerEasterEgg();
            } else {
                this.holdTimer = requestAnimationFrame(() => this.updateProgress());
            }
        }

        endHold() {
            const logoContainer = document.querySelector('#header .logo');
            if (logoContainer) {
                logoContainer.classList.remove('si-logo-shaking');
            }
            if (this.countdownRing) {
                this.countdownRing.classList.remove('si-visible');
            }
            
            this.holdStartTime = null;
            this.holdProgress = 0;
            
            if (this.progressCircle) {
                this.progressCircle.style.strokeDashoffset = this.circumference;
            }
            
            if (this.holdTimer) {
                cancelAnimationFrame(this.holdTimer);
                this.holdTimer = null;
            }
        }

        triggerEasterEgg() {
            this.audio.rocketLaunch();
            this.endHold();
            
            // Slide wrapper down
            const wrapper = document.getElementById('wrapper');
            wrapper.classList.add('si-slide-down');
            
            // Show game container
            setTimeout(() => {
                const gameContainer = document.getElementById('si-game-container');
                gameContainer.classList.add('si-active');
            }, 200);
            
            // Initialize game display
            setTimeout(() => {
                this.game.show();
            }, 1700);
        }
    }

    // ===== INITIALIZATION =====
    function initSpaceInvaders() {
        // Create game container HTML
        const gameHTML = `
            <div id="si-game-container">
                <div id="si-game-ui">
                    <div>SCORE <span id="si-score">0</span></div>
                    <div>LIVES <span id="si-lives">3</span></div>
                    <div>HI-SCORE <span id="si-hi-score">0</span></div>
                </div>
                <canvas id="si-canvas"></canvas>
                <div id="si-exit-hint">ESC to exit | Arrow keys to move | Space to fire</div>
                
                <div id="si-mobile-controls">
                    <div class="si-direction-btns">
                        <button class="si-mobile-btn" id="si-btn-left">◀</button>
                        <button class="si-mobile-btn" id="si-btn-right">▶</button>
                    </div>
                    <button class="si-mobile-btn" id="si-btn-fire">FIRE</button>
                </div>

                <div id="si-overlay">
                    <h2 id="si-overlay-title">SPACE INVADERS</h2>
                    <p>RAC Edition</p>
                    <div id="si-final-score"></div>
                    <p id="si-instructions">Arrow Keys / Touch to Move<br>Space / Tap Fire to Shoot</p>
                    <div class="si-slider-container" id="si-slider-container">
                        <label class="si-slider-label">SHIP SPEED</label>
                        <input type="range" id="si-sensitivity-slider" min="0.5" max="2.5" step="0.1" value="1.0">
                        <span class="si-slider-value" id="si-sensitivity-value">1.0x</span>
                    </div>
                    <button id="si-start-btn">START GAME</button>
                </div>
            </div>
        `;
        
        // Insert game container into body
        document.body.insertAdjacentHTML('beforeend', gameHTML);
        
        // Initialize game and trigger
        const game = new SpaceInvadersGame();
        game.init();
        
        const trigger = new EasterEggTrigger(game);
        trigger.init();
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSpaceInvaders);
    } else {
        initSpaceInvaders();
    }

})();
