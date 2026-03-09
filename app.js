const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.3;
const KICK_FORCE = -10;
const BALL_SIZE = 16;
const GROUND_Y = canvas.height - 40;

// Hit zone: starts from ground to halfway, shrinks to 5% at bottom
const PLAY_HEIGHT = GROUND_Y;                    // full playable height
const ZONE_HEIGHT_START = PLAY_HEIGHT * 0.5;     // starts at 50% of screen
const ZONE_HEIGHT_MIN = PLAY_HEIGHT * 0.05;      // shrinks to 5%
const ZONE_SHRINK_SCORE = 50;                    // score at which zone reaches minimum

// Game state
let ball = { x: canvas.width / 2, y: canvas.height / 2, vy: 0, vx: 0 };
let score = 0;
let highScore = parseInt(localStorage.getItem('keepy_high') || '0');
let state = 'start'; // 'start', 'playing', 'over'
let particles = [];
let screenShake = 0;
let canKick = true;        // only one kick per ball rise
let wasGoingDown = false;  // track when ball starts falling

// Hit zone (where you must tap)
let zoneHeight = ZONE_HEIGHT_START;
let zoneTop = GROUND_Y - zoneHeight;

// 8-bit color palette
const COLORS = {
    bg: '#0f0e17',
    ground: '#2e7d32',
    groundDark: '#1b5e20',
    ball: '#e94560',
    ballHighlight: '#ff6b81',
    text: '#fffffe',
    textShadow: '#0f0e17',
    score: '#f9d71c',
    zone: 'rgba(0, 210, 211, 0.15)',
    zoneBorder: '#00d2d3',
    zoneActive: 'rgba(0, 210, 211, 0.35)',
    zoneLocked: 'rgba(255, 50, 50, 0.1)',
    zoneBorderLocked: '#ff4444',
    particle: ['#e94560', '#f9d71c', '#00d2d3', '#ff9ff3', '#54a0ff']
};

function resetGame() {
    score = 0;
    ball = { x: canvas.width / 2, y: GROUND_Y - BALL_SIZE - 50, vy: 0, vx: 0 };
    canKick = true;
    wasGoingDown = false;
    updateZone();
    particles = [];
}

function getZoneBottom() {
    return zoneTop + zoneHeight;
}

function ballInZone() {
    return ball.y >= zoneTop - BALL_SIZE && ball.y <= getZoneBottom() + BALL_SIZE;
}

function updateZone() {
    // Zone always anchored to ground, shrinks from top down
    let progress = Math.min(score / ZONE_SHRINK_SCORE, 1); // 0 to 1
    zoneHeight = ZONE_HEIGHT_START - (ZONE_HEIGHT_START - ZONE_HEIGHT_MIN) * progress;
    zoneTop = GROUND_Y - zoneHeight;
}

// Draw an 8-bit style circle (pixelated)
function drawPixelCircle(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y += 2) {
        for (let x = -r; x <= r; x += 2) {
            if (x * x + y * y <= r * r) {
                ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 2, 2);
            }
        }
    }
}

function drawText(text, x, y, size, color, align) {
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = COLORS.textShadow;
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color || COLORS.text;
    ctx.fillText(text, x, y);
}

function spawnParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 20 + Math.random() * 10,
            color: COLORS.particle[Math.floor(Math.random() * COLORS.particle.length)],
            size: 2 + Math.random() * 3
        });
    }
}

// Handle input
function kick() {
    if (state === 'start') {
        state = 'playing';
        resetGame();
        // First kick is free
        ball.vy = KICK_FORCE;
        ball.vx = (Math.random() - 0.5) * 4;
        score = 1;
        canKick = false;
        screenShake = 4;
        spawnParticles(ball.x, ball.y);
        return;
    }

    if (state === 'playing') {
        if (!canKick) return;         // already used your one tap

        // One tap per fall — used up whether in zone or not
        canKick = false;

        if (!ballInZone()) {
            // Tapped outside zone — game over!
            state = 'over';
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('keepy_high', highScore.toString());
            }
            return;
        }

        ball.vy = KICK_FORCE;
        ball.vx = (Math.random() - 0.5) * 4;
        score++;
        screenShake = 4;
        spawnParticles(ball.x, ball.y);
        updateZone();
        return;
    }

    if (state === 'over') {
        state = 'start';
    }
}

document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        kick();
    }
});

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    kick();
});

canvas.addEventListener('mousedown', function(e) {
    kick();
});

// Draw the hit zone
function drawZone() {
    let inZone = ballInZone();
    let bottom = getZoneBottom();

    if (canKick) {
        // Active zone
        ctx.fillStyle = inZone ? COLORS.zoneActive : COLORS.zone;
        ctx.fillRect(0, zoneTop, canvas.width, zoneHeight);

        // Dashed pixel borders
        ctx.fillStyle = COLORS.zoneBorder;
        for (let x = 0; x < canvas.width; x += 8) {
            ctx.fillRect(x, zoneTop, 4, 2);
            ctx.fillRect(x, bottom - 2, 4, 2);
        }
        // Side markers
        ctx.fillRect(0, zoneTop, 2, zoneHeight);
        ctx.fillRect(canvas.width - 2, zoneTop, 2, zoneHeight);
    } else {
        // Locked zone (already kicked)
        ctx.fillStyle = COLORS.zoneLocked;
        ctx.fillRect(0, zoneTop, canvas.width, zoneHeight);

        ctx.fillStyle = COLORS.zoneBorderLocked;
        for (let x = 0; x < canvas.width; x += 8) {
            ctx.fillRect(x, zoneTop, 4, 2);
            ctx.fillRect(x, bottom - 2, 4, 2);
        }
    }
}

function drawGround() {
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = COLORS.groundDark;
    for (let x = 0; x < canvas.width; x += 8) {
        let h = (x * 7 + 3) % 5;
        ctx.fillRect(x, GROUND_Y, 4, 2 + h);
    }
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, GROUND_Y, canvas.width, 2);
}

function drawBall() {
    let shadowScale = 1 - (GROUND_Y - ball.y) / canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ball.x - BALL_SIZE * shadowScale / 2, GROUND_Y + 4, BALL_SIZE * shadowScale, 4);
    drawPixelCircle(ball.x, ball.y, BALL_SIZE, COLORS.ball);
    drawPixelCircle(ball.x - 4, ball.y - 4, 5, COLORS.ballHighlight);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = p.color;
        let s = Math.ceil(p.size * (p.life / 30));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
}

let stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (GROUND_Y - 20),
        blink: Math.random() * 100
    });
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let s of stars) {
        s.blink += 0.5;
        if (Math.sin(s.blink * 0.05) > 0.3) {
            ctx.fillRect(s.x, s.y, 2, 2);
        }
    }
}

// Main game loop
function update() {
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake;
        shakeY = (Math.random() - 0.5) * screenShake;
        screenShake *= 0.8;
        if (screenShake < 0.5) screenShake = 0;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-5, -5, canvas.width + 10, canvas.height + 10);
    drawStars();
    drawGround();

    if (state === 'start') {
        // Show zone preview
        drawZone();
        drawBall();
        drawText('KEEPY UPPY', canvas.width / 2, 100, 36, COLORS.score);
        drawText('Hit the ball in the', canvas.width / 2, 170, 14, COLORS.text);
        drawText('ZONE only!', canvas.width / 2, 190, 18, COLORS.zoneBorder);
        drawText('One tap per bounce', canvas.width / 2, 220, 14, COLORS.text);
        drawText('SPACE / TAP to start', canvas.width / 2, 260, 16, COLORS.text);
        if (highScore > 0) {
            drawText('Best: ' + highScore, canvas.width / 2, 300, 20, COLORS.score);
        }
    }

    if (state === 'playing') {
        // Physics
        ball.vy += GRAVITY;
        ball.y += ball.vy;
        ball.x += ball.vx;

        // Track ball direction: only re-enable kick after ball went UP then starts falling
        if (ball.vy < -2) {
            // Ball is going up with force — mark it
            wasGoingDown = false;
        }
        if (!wasGoingDown && ball.vy > 0) {
            // Ball just peaked and started falling — allow one new tap
            wasGoingDown = true;
            canKick = true;
        }

        // Bounce off walls
        if (ball.x < BALL_SIZE) {
            ball.x = BALL_SIZE;
            ball.vx = -ball.vx * 0.8;
        }
        if (ball.x > canvas.width - BALL_SIZE) {
            ball.x = canvas.width - BALL_SIZE;
            ball.vx = -ball.vx * 0.8;
        }

        // Bounce off ceiling
        if (ball.y < BALL_SIZE) {
            ball.y = BALL_SIZE;
            ball.vy = Math.abs(ball.vy) * 0.5;
        }

        // Hit ground = game over
        if (ball.y >= GROUND_Y - BALL_SIZE) {
            ball.y = GROUND_Y - BALL_SIZE;
            state = 'over';
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('keepy_high', highScore.toString());
            }
        }

        drawZone();
        drawBall();
        updateParticles();
        drawParticles();

        // Score
        drawText(score.toString(), canvas.width / 2, 50, 48, COLORS.score);

        // Kick status indicator
        if (canKick && ballInZone()) {
            drawText('HIT!', canvas.width / 2, 85, 14, COLORS.zoneBorder);
        } else if (!canKick) {
            drawText('WAIT...', canvas.width / 2, 85, 12, COLORS.zoneBorderLocked);
        }
    }

    if (state === 'over') {
        drawZone();
        drawBall();
        drawParticles();
        updateParticles();

        drawText('GAME OVER', canvas.width / 2, 140, 36, COLORS.ball);
        drawText('Score: ' + score, canvas.width / 2, 200, 28, COLORS.text);
        if (score >= highScore && score > 0) {
            drawText('NEW BEST!', canvas.width / 2, 240, 20, COLORS.score);
        } else {
            drawText('Best: ' + highScore, canvas.width / 2, 240, 20, COLORS.score);
        }
        drawText('TAP or SPACE to retry', canvas.width / 2, 310, 16, COLORS.text);
    }

    ctx.restore();
    requestAnimationFrame(update);
}

update();
