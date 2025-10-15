// Game state
let gameActive = false;
let score = 0;
let gameLoop = null;
let enemySpawnInterval = null;
let playerPosition = { x: 0, y: 0 };
let bullets = [];
let enemies = [];
let keys = {};
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let baseEnemySpeed = 2;
let enemySpawnRate = 1500; // ms
let lastEnemySpawnTime = 0;

// DOM elements
const player = document.getElementById('player');
const gameOverElement = document.getElementById('game-over');
const restartButton = document.getElementById('restart-btn');
const gameContainer = document.getElementById('game-container');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-btn');
const finalScoreElement = document.getElementById('final-score');

// Get score element and style it
const scoreElement = document.getElementById('score');
if (scoreElement) {
    scoreElement.style.position = 'fixed';
    scoreElement.style.top = '10px';
    scoreElement.style.right = '10px';
    scoreElement.style.color = 'white';
    scoreElement.style.fontSize = '24px';
    scoreElement.style.textShadow = '0 0 5px black';
    scoreElement.style.zIndex = '100';
}

// Mobile controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnShoot = document.getElementById('btn-shoot');

// Game constants
const PLAYER_SPEED = isMobile ? 5 : 12; // Further reduced mobile speed for better precision
const BULLET_SPEED = isMobile ? 9 : 7; // Keep bullet speed the same

// Mobile-specific difficulty settings
const MOBILE_DIFFICULTY_MULTIPLIER = 1.6; // Increased from 1.4 to 1.6 for more challenge
const BASE_ENEMY_SPEED = isMobile ? 2.0 : 1.0; // Increased from 1.5 to 2.0 for faster enemies
const ENEMY_SPEED_VARIANCE = isMobile ? 0.8 : 0.6; // More speed variance on mobile
const ENEMY_SPEED_INCREASE = isMobile ? 0.3 : 0.2; // Increased from 0.25 to 0.3 for faster difficulty ramp
const AUTO_SHOOT_INTERVAL = isMobile ? 200 : 300; // Faster shooting on mobile (reduced from 250ms to 200ms)
const MIN_ENEMY_SPAWN_RATE = isMobile ? 200 : 500; // Faster minimum spawn rate (reduced from 300ms to 200ms)
const MAX_ENEMY_SPAWN_RATE = isMobile ? 800 : 1500; // Faster maximum spawn rate (reduced from 1000ms to 800ms)
const ENEMY_SIZE_RANGE = isMobile ? [25, 45] : [30, 50]; // Smaller and more varied enemy sizes on mobile
const ENEMY_HEALTH_MULTIPLIER = isMobile ? 1.2 : 1.0; // Slightly more health on mobile

let lastShotTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

// Initialize game when DOM is fully loaded
function initGame() {
    // Set up event listeners
    setupEventListeners();
    
    // Show start screen
    showStartScreen();
}

function setupEventListeners() {
    // Remove existing listeners to prevent duplicates
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    startButton.removeEventListener('click', startGame);
    restartButton.removeEventListener('click', handleRestart);
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', handleRestart);
    
    // Mobile control event listeners
    if (isMobile) {
        setupMobileControls();
    }
}

function showStartScreen() {
    if (startScreen) startScreen.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    if (gameOverElement) gameOverElement.classList.add('hidden');
}

function handleRestart(e) {
    // Prevent any default behavior
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Add a small delay to ensure the button press is registered
    setTimeout(() => {
        resetGame();
        startGame();
    }, 100);
}

function resetGame() {
    // Clear game state
    if (enemySpawnInterval) {
        clearInterval(enemySpawnInterval);
        enemySpawnInterval = null;
    }
    
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    
    // Reset game state
    gameActive = false;
    bullets = [];
    enemies = [];
    keys = {};
    score = 0;
    
    // Reset UI
    if (scoreElement) scoreElement.textContent = 'Score: 0';
    if (finalScoreElement) finalScoreElement.textContent = '0';
    
    // Clear game elements
    document.querySelectorAll('.enemy, .bullet, .explosion').forEach(el => el.remove());
    
    // Reset player position
    resetPlayerPosition();
}

function resetPlayerPosition() {
    if (!player) return;
    
    playerPosition = { 
        x: Math.min(Math.max(window.innerWidth / 2, 24), window.innerWidth - 24),
        y: 80 // 80px from bottom
    };
    player.style.left = `${playerPosition.x - 24}px`;
    player.style.bottom = `${playerPosition.y}px`;
}

// Event listeners
function handleKeyDown(e) {
    if (!gameActive) return;
    
    const key = e.key.toLowerCase();
    keys[key] = true;
    
    // Space to shoot (only spacebar, not W or up arrow)
    if (key === ' ') {
        e.preventDefault(); // Prevent page scrolling
        if (gameActive) shoot();
    }
}

function handleKeyUp(e) {
    const key = e.key.toLowerCase();
    keys[key] = false;
    
    // Also handle the uppercase version if it exists
    if (e.key !== key) {
        keys[e.key] = false;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    // DOMContentLoaded has already fired
    initGame();
}

// Touch controls for mobile
if (isMobile) {
    // Hide all mobile controls
    document.getElementById('mobile-controls').style.display = 'none';

    // Touch start for movement
    gameContainer.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isTouching = true;
        e.preventDefault();
    });

    // Touch move for movement and auto-shooting
    gameContainer.addEventListener('touchmove', (e) => {
        if (!gameActive || !isTouching) return;
        
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        
        // Move player
        const newX = playerPosition.x + dx;
        const newY = playerPosition.y - dy; // Invert Y for bottom-based coordinate system
        
        // Keep player in bounds
        playerPosition.x = Math.max(24, Math.min(window.innerWidth - 24, newX));
        playerPosition.y = Math.max(24, Math.min(window.innerHeight - 100, newY)); // Keep player from going too high
        
        // Update touch position for next move
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        // Auto-shoot while moving
        const now = Date.now();
        if (now - lastShotTime > AUTO_SHOOT_INTERVAL) {
            shoot();
            lastShotTime = now;
        }
        
        e.preventDefault();
    });

    // Touch end
    gameContainer.addEventListener('touchend', (e) => {
        isTouching = false;
        e.preventDefault();
    });

    // Prevent default touch behavior
    gameContainer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

// Keyboard controls for desktop
if (!isMobile) {
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        
        // Space to shoot
        if (e.key === ' ' && gameActive) {
            e.preventDefault();
            shoot();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
}

// Game functions
function updatePlayerPosition() {
    // Update player position (handled by touch events on mobile)
    if (!isMobile) {
        // Keep keyboard controls for desktop
        if ((keys['arrowleft'] || keys['a']) && playerPosition.x > 24) {
            playerPosition.x -= PLAYER_SPEED;
        }
        if ((keys['arrowright'] || keys['d']) && playerPosition.x < window.innerWidth - 24) {
            playerPosition.x += PLAYER_SPEED;
        }
        if ((keys['arrowup'] || keys['w']) && playerPosition.y < window.innerHeight - 24) {
            playerPosition.y += PLAYER_SPEED;
        }
        if ((keys['arrowdown'] || keys['s']) && playerPosition.y > 24) {
            playerPosition.y -= PLAYER_SPEED;
        }
    }

    // Update player position in the DOM
    player.style.left = `${playerPosition.x - 24}px`;
    player.style.bottom = `${playerPosition.y}px`;
    
    // Update player's position for collision detection
    playerRect = {
        x: playerPosition.x - 24,
        y: window.innerHeight - playerPosition.y - 24,
        width: 48,
        height: 48
    };
}

function shoot() {
    if (!gameActive) return;
    
    const bullet = document.createElement('div');
    bullet.className = 'bullet';
    
    // Bullet dimensions
    const bulletWidth = 6;
    const bulletHeight = 15;
    
    // Player dimensions (48x48px from w-12 h-12 in Tailwind)
    const playerSize = 48;
    
    // Get player's current position in the viewport
    const playerRect = player.getBoundingClientRect();
    const gameRect = gameContainer.getBoundingClientRect();
    
    // Calculate bullet position to be exactly at the center of the player's blue dot
    const bulletX = (playerRect.left + playerRect.width / 2) - (bulletWidth / 2) - gameRect.left;
    const bulletY = gameRect.bottom - (playerRect.top + playerRect.height / 2) - (bulletHeight / 2);
    
    // Set position
    bullet.style.left = `${bulletX}px`;
    bullet.style.bottom = `${bulletY}px`;
    
    // Make sure bullet is visible
    bullet.style.position = 'absolute';
    bullet.style.backgroundColor = 'white';
    bullet.style.borderRadius = '3px';
    
    gameContainer.appendChild(bullet);
    
    // Store bullet data for collision detection
    bullets.push({
        element: bullet,
        x: bulletX,
        y: bulletY,  // Using bottom-based Y for consistency
        width: bulletWidth,
        height: bulletHeight
    });
}

// Update the bullet movement to work with bottom-based Y coordinates
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet up (increase bottom position)
        bullet.y += BULLET_SPEED;
        bullet.element.style.bottom = `${bullet.y}px`;
        
        // Remove if off screen (above top of game container)
        if (bullet.y > window.innerHeight) {
            bullet.element.remove();
            bullets.splice(i, 1);
        }
    }
}

// Update the bullet movement to work with the new coordinate system
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet up (decrease Y in top-based coordinates)
        bullet.y -= BULLET_SPEED;
        
        // Update position in the DOM (convert back to bottom-based for rendering)
        bullet.element.style.bottom = `${window.innerHeight - bullet.y - bullet.height}px`;
        
        // Remove if off screen
        if (bullet.y + bullet.height < 0) {
            bullet.element.remove();
            bullets.splice(i, 1);
            continue;
        }
        
        // Check collisions (using existing collision logic)
        // ...
    }
}

function spawnEnemy() {
    if (!gameActive) return;
    
    const now = Date.now();
    if (now - lastEnemySpawnTime < enemySpawnRate) return;
    
    const enemy = document.createElement('div');
    enemy.className = 'enemy';
    gameContainer.appendChild(enemy);
    
    // Random x position, but avoid spawning directly on player
    let x;
    do {
        x = Math.random() * (window.innerWidth - 40);
    } while (Math.abs(x - playerPosition.x) < 100 && Math.random() > 0.3); // 30% chance to ignore proximity check
    
    // Calculate speed increase based on score (100 points = +0.2 speed)
    const speedIncrease = Math.floor(score / 100) * ENEMY_SPEED_INCREASE;
    const maxSpeed = 3.0; // Maximum speed cap
    
    // Calculate base speed with increase, but don't exceed max speed
    const baseSpeed = Math.min(BASE_ENEMY_SPEED + speedIncrease, maxSpeed);
    
    // Apply slight random variance
    const speed = baseSpeed + (Math.random() * ENEMY_SPEED_VARIANCE);
    
    // Random size variation (smaller enemies are faster)
    const size = 30 + Math.random() * 20; // 30-50px
    const speedMultiplier = 1 + ((50 - size) * 0.02); // Smaller = faster
    
    enemies.push({
        element: enemy,
        x: x,
        y: -size,
        width: size,
        height: size,
        speed: speed * speedMultiplier
    });
    
    enemy.style.width = `${size}px`;
    enemy.style.height = `${size}px`;
    enemy.style.left = `${x}px`;
    enemy.style.top = `-${size}px`;
    
    // Update spawn rate based on score - faster ramp-up on mobile
    enemySpawnRate = Math.max(
        MIN_ENEMY_SPAWN_RATE, 
        MAX_ENEMY_SPAWN_RATE - (difficulty * (isMobile ? 250 : 200))
    );
    
    lastEnemySpawnTime = now;
    
    // Occasionally spawn 2 enemies at once at higher difficulties
    if (difficulty > 2 && Math.random() > 0.7) {
        setTimeout(() => {
            if (gameActive) spawnEnemy();
        }, 100);
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet up (increase Y position since it's bottom-based)
        bullet.y += BULLET_SPEED;
        bullet.element.style.bottom = `${bullet.y}px`;
        
        // Remove if off top of screen
        if (bullet.y > window.innerHeight) {
            bullet.element.remove();
            bullets.splice(i, 1);
            continue;
        }
        
        // Get bullet's screen position
        const bulletRect = bullet.element.getBoundingClientRect();
        
        // Check collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const enemyRect = enemy.element.getBoundingClientRect();
            
            // Precise collision detection
            if (bulletRect.right > enemyRect.left && 
                bulletRect.left < enemyRect.right &&
                bulletRect.bottom > enemyRect.top && 
                bulletRect.top < enemyRect.bottom) {
                
                // Remove bullet and enemy
                bullet.element.remove();
                bullets.splice(i, 1);
                
                // Create explosion effect
                createExplosion(enemy.x, enemy.y);
                
                // Remove enemy
                enemy.element.remove();
                enemies.splice(j, 1);
                
                // Update score
                score += 10;
                scoreElement.textContent = `Score: ${score}`;
                break;
            }
        }
    }
}

function updateScore(points) {
    score += points;
    score = Math.max(0, score); // Ensure score doesn't go below 0
    scoreElement.textContent = `Score: ${score}`;
    
    // Game over if score reaches 0
    if (score <= 0) {
        gameOver();
    }
}

function updateEnemies() {
    // Get player's screen position
    const playerRect = player.getBoundingClientRect();
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.y += enemy.speed; // Use individual enemy speed
        enemy.element.style.top = `${enemy.y}px`;
        
        // Get enemy's screen position
        const enemyRect = enemy.element.getBoundingClientRect();
        
        // Check collision with player
        if (playerRect.right > enemyRect.left && 
            playerRect.left < enemyRect.right &&
            playerRect.bottom > enemyRect.top && 
            playerRect.top < enemyRect.bottom) {
            gameOver();
            return;
        }
        
        // Check if enemy reached bottom
        if (enemy.y > window.innerHeight) {
            enemy.element.remove();
            enemies.splice(i, 1);
            
            // Deduct points when enemy escapes
            updateScore(-10);
        }
    }
}

function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x - 5}px`;
    explosion.style.top = `${y}px`;
    gameContainer.appendChild(explosion);
    
    // Remove explosion after animation
    setTimeout(() => {
        explosion.remove();
    }, 500);
}

function checkCollision(rect1, rect2) {
    // For player (rect1 is player, rect2 is bullet)
    if (rect2.isEnemyBullet) {
        const bulletTop = rect2.y;
        const bulletBottom = rect2.y + rect2.height;
        const bulletLeft = rect2.x;
        const bulletRight = rect2.x + rect2.width;

        return (rect1.x < bulletRight &&
                rect1.x + rect1.width > bulletLeft &&
                rect1.y < bulletBottom &&
                rect1.y + rect1.height > bulletTop);
    }
    
    // For player bullets hitting enemies (rect1 is bullet, rect2 is enemy)
    if (!rect1.isEnemyBullet) {
        const bulletBottom = window.innerHeight - rect1.y;
        const bulletTop = bulletBottom - rect1.height;
        const bulletLeft = rect1.x;
        const bulletRight = rect1.x + rect1.width;

        return (rect2.x < bulletRight &&
                rect2.x + rect2.width > bulletLeft &&
                rect2.y < bulletBottom &&
                rect2.y + rect2.height > bulletTop);
    }
    
return false;
}

function gameOver() {
gameActive = false;
    
// Clear game loops
if (enemySpawnInterval) {
    clearInterval(enemySpawnInterval);
    enemySpawnInterval = null;
}
    
if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
}
    
// Update final score
if (finalScoreElement) {
    finalScoreElement.textContent = score;
}
    
// Show game over screen
if (gameOverElement) {
    gameOverElement.classList.remove('hidden');
}
}

function runGame() {
if (!gameActive) return;
    
updatePlayerPosition();
updateBullets();
updateEnemies();
    updateBullets();
    updateEnemies();
    
    requestAnimationFrame(runGame);
}

function startGame() {
    // Hide start screen and show game container
    if (startScreen) startScreen.classList.add('hidden');
    if (gameContainer) gameContainer.classList.remove('hidden');
    if (gameOverElement) gameOverElement.classList.add('hidden');
    
    // Reset game state
    gameActive = true;
    score = 0;
    
    // Update score display
    if (scoreElement) scoreElement.textContent = 'Score: 0';
    
    // Clear existing game elements
    document.querySelectorAll('.enemy, .bullet, .explosion').forEach(el => el.remove());
    enemies = [];
    bullets = [];
    
    // Reset player position
    resetPlayerPosition();
    
    // Clear any existing intervals
    if (enemySpawnInterval) {
        clearInterval(enemySpawnInterval);
        enemySpawnInterval = null;
    }
    
    // Clear any existing game loop
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    
    // Start game loops
    enemySpawnInterval = setInterval(spawnEnemy, 1000);
    
    // Start game loop
    lastTime = Date.now();
    gameLoop = requestAnimationFrame(runGame);
}

// Initialize the game when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    // DOMContentLoaded has already fired
    initGame();
}
