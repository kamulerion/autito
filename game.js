/**
 * Cyber Autito - game.js (Fase 2: Modelo del Auto y Controles)
 * 
 * En esta fase:
 * 1. Modelamos un autito con formas geométricas básicas (programmer art).
 * 2. Implementamos el sistema de movimiento lateral por carriles usando LERP (interpolación lineal).
 * 3. Añadimos controles de teclado (A/D, W/S y Flechas) y controles táctiles (Swipe) para móviles.
 * 4. Hacemos que la velocidad sea controlable y que afecte el movimiento visual de la carretera.
 */

// --- CONFIGURACIÓN GLOBAL DEL JUEGO ---
const GameConfig = {
    laneCount: 5,        // Número total de carriles
    laneWidth: 1.6,      // Ancho de cada carril en unidades Three.js (metros)
    roadLength: 100,     // Largo visible de la autopista
    minSpeed: 5,         // Velocidad mínima del auto
    defaultSpeed: 12,    // Velocidad crucero normal
    maxSpeed: 25,        // Velocidad máxima con aceleración
    speedChangeRate: 15  // Qué tan rápido acelera/desacelera por segundo
};

// --- VARIABLES DE MOTOR Y ESCENARIO ---
let scene, camera, renderer;
let roadPlane;
let laneLines = [];      // Guardará los segmentos de las líneas divisorias
let gameActive = false;
let lastTime = 0;        // Para calcular el deltaTime (tiempo entre fotogramas)

// --- VARIABLES DEL JUGADOR (AUTO Y CONTROLES) ---
let playerCar;           // El objeto del auto (THREE.Group)
let currentLane = 2;     // Carril actual (0 = Extremo Izquierdo, 2 = Centro, 4 = Extremo Derecho)
let targetX = 0;         // Posición X objetivo a la que el auto debe moverse
let currentSpeed = GameConfig.defaultSpeed;
let targetSpeed = GameConfig.defaultSpeed;

// --- VARIABLES DE OBSTÁCULOS (DINOSAURIOS CORREDORES) ---
let obstacles = [];          // Dinosaurios activos en la carretera
let obstaclePool = [];       // Contenedor de dinosaurios inactivos para reusar (Object Pooling)
const maxObstaclesInPool = 8; // Límite de dinosaurios en memoria
let timeSinceLastSpawn = 0;  // Cronómetro de generación
const spawnInterval = 1.6;   // Segundos entre la generación de cada dinosaurio

// Variables para gestos táctiles (móviles)
let touchStartX = 0;
let touchStartY = 0;
const minSwipeDistance = 30; // Distancia mínima en píxeles para reconocer un deslizamiento (swipe)

// Al cargar el documento, inicializamos el juego
window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    createWorld();
    createPlayerCar();
    createObstaclePool(); // Inicializamos el pool de dinosaurios antes de jugar
    setupEvents();
    
    // Iniciamos el ciclo principal del juego
    animate(0);
});

/**
 * 1. Inicialización de Three.js (Igual que en Fase 1)
 */
function initEngine() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Fondo oscuro para resaltar las mallas simples

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // Colocamos la cámara detrás del auto y un poco inclinada hacia abajo
    camera.position.set(0, 3.2, 5.5);
    camera.lookAt(new THREE.Vector3(0, 0.8, -10));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 12, 8);
    scene.add(dirLight);
}

/**
 * 2. Creación de la Carretera y el Entorno
 */
function createWorld() {
    const roadWidth = GameConfig.laneCount * GameConfig.laneWidth;

    // Autopista (Plano Asfalto)
    const roadGeo = new THREE.PlaneGeometry(roadWidth, GameConfig.roadLength);
    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.9,
        metalness: 0.1
    });
    roadPlane = new THREE.Mesh(roadGeo, roadMat);
    roadPlane.rotation.x = -Math.PI / 2;
    // La carretera se extiende desde Z = 0 hacia Z = -roadLength
    roadPlane.position.z = -GameConfig.roadLength / 2;
    scene.add(roadPlane);

    // Crear las líneas divisorias de los carriles
    // En lugar de una sola tira larga, creamos segmentos cortos para poder moverlos hacia atrás
    // y dar la ilusión visual de que el auto está avanzando (scroll infinito).
    const startX = -roadWidth / 2;
    const segmentLength = 2; // Largo de cada línea pintada
    const segmentGap = 2;    // Espacio entre líneas pintadas
    
    for (let i = 1; i < GameConfig.laneCount; i++) {
        const lineX = startX + (i * GameConfig.laneWidth);
        
        // Creamos múltiples segmentos de línea a lo largo de la carretera
        for (let z = 0; z > -GameConfig.roadLength; z -= (segmentLength + segmentGap)) {
            const lineGeo = new THREE.BoxGeometry(0.06, 0.01, segmentLength);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
            const lineMesh = new THREE.Mesh(lineGeo, lineMat);
            
            lineMesh.position.set(lineX, 0.005, z);
            scene.add(lineMesh);
            laneLines.push(lineMesh); // Guardamos la referencia para animarlas en el loop
        }
    }

    // Bordes laterales (Redones de la carretera)
    const borderGeo = new THREE.BoxGeometry(0.12, 0.08, GameConfig.roadLength);
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xef4444 }); // Rojo
    
    const leftBorder = new THREE.Mesh(borderGeo, borderMat);
    leftBorder.position.set(-roadWidth / 2, 0.04, -GameConfig.roadLength / 2);
    scene.add(leftBorder);

    const rightBorder = new THREE.Mesh(borderGeo, borderMat);
    rightBorder.position.set(roadWidth / 2, 0.04, -GameConfig.roadLength / 2);
    scene.add(rightBorder);
}

/**
 * Función que construye un dinosaurio T-Rex en 3D utilizando bloques y geometrías simples.
 */
function createDinosaur() {
    const dino = new THREE.Group();
    
    // Paleta de materiales
    const dinoMat = new THREE.MeshStandardMaterial({ color: 0x8fa39b, roughness: 0.8, metalness: 0.1 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xa5baa5, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x4f5450, roughness: 0.9 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const teethMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });

    // A. CUERPO
    const bodyGeo = new THREE.BoxGeometry(0.38, 0.48, 0.48);
    const body = new THREE.Mesh(bodyGeo, dinoMat);
    body.position.set(0, 0.24, -0.04);
    dino.add(body);

    const bellyGeo = new THREE.BoxGeometry(0.32, 0.38, 0.08);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.24, 0.21);
    dino.add(belly);

    // B. CUELLO
    const neckGeo = new THREE.BoxGeometry(0.24, 0.22, 0.24);
    const neck = new THREE.Mesh(neckGeo, dinoMat);
    neck.position.set(0, 0.46, 0.08);
    neck.rotation.x = 0.15;
    dino.add(neck);

    // C. CABEZA
    const headGeo = new THREE.BoxGeometry(0.34, 0.32, 0.42);
    const head = new THREE.Mesh(headGeo, dinoMat);
    head.position.set(0, 0.62, 0.18);
    dino.add(head);

    const jawGeo = new THREE.BoxGeometry(0.32, 0.1, 0.32);
    const jaw = new THREE.Mesh(jawGeo, dinoMat);
    jaw.position.set(0, 0.46, 0.22);
    jaw.rotation.x = -0.12;
    dino.add(jaw);

    // D. DIENTES
    const toothGeo = new THREE.BoxGeometry(0.04, 0.05, 0.04);
    const toothL1 = new THREE.Mesh(toothGeo, teethMat);
    toothL1.position.set(-0.16, 0.50, 0.35);
    dino.add(toothL1);
    const toothL2 = new THREE.Mesh(toothGeo, teethMat);
    toothL2.position.set(-0.16, 0.50, 0.25);
    dino.add(toothL2);
    const toothR1 = new THREE.Mesh(toothGeo, teethMat);
    toothR1.position.set(0.16, 0.50, 0.35);
    dino.add(toothR1);
    const toothR2 = new THREE.Mesh(toothGeo, teethMat);
    toothR2.position.set(0.16, 0.50, 0.25);
    dino.add(toothR2);

    // E. OJOS
    const eyeGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
    const eyeL = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeL.position.set(-0.17, 0.66, 0.22);
    dino.add(eyeL);
    const pupilL = new THREE.Mesh(pupilGeo, eyePupilMat);
    pupilL.position.set(-0.21, 0.66, 0.27);
    dino.add(pupilL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eyeR.position.set(0.17, 0.66, 0.22);
    dino.add(eyeR);
    const pupilR = new THREE.Mesh(pupilGeo, eyePupilMat);
    pupilR.position.set(0.21, 0.66, 0.27);
    dino.add(pupilR);

    // F. PATAS
    const legGeo = new THREE.BoxGeometry(0.12, 0.32, 0.2);
    const legL = new THREE.Mesh(legGeo, dinoMat);
    legL.position.set(-0.15, 0.1, 0);
    dino.add(legL);
    const legR = new THREE.Mesh(legGeo, dinoMat);
    legR.position.set(0.15, 0.1, 0);
    dino.add(legR);

    // Guardamos referencias de las patas en userData para poder animarlas cuando el dino corra
    dino.userData = { legL: legL, legR: legR };

    return dino;
}

/**
 * 3. Modelado del Auto del Jugador
 */
function createPlayerCar() {
    playerCar = new THREE.Group();

    const chassisGeo = new THREE.BoxGeometry(0.8, 0.25, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.15;
    playerCar.add(chassis);

    const cabinGeo = new THREE.BoxGeometry(0.65, 0.25, 0.7);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.35, 0.1);
    playerCar.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    
    const wheelPositions = [
        { x: -0.45, y: 0.2, z: 0.45 }, { x: 0.45, y: 0.2, z: 0.45 },
        { x: -0.45, y: 0.2, z: -0.45 }, { x: 0.45, y: 0.2, z: -0.45 }
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.rotation.z = Math.PI / 2;
        playerCar.add(wheel);
    });

    const dinoMascot = createDinosaur();
    dinoMascot.position.set(0, 0.46, -0.05);
    dinoMascot.scale.set(0.75, 0.75, 0.75);
    playerCar.add(dinoMascot);

    targetX = getLaneX(currentLane);
    playerCar.position.set(targetX, 0, 0);
    
    scene.add(playerCar);
}

/**
 * Inicialización del pool de objetos (Object Pooling) para los dinosaurios.
 */
function createObstaclePool() {
    for (let i = 0; i < maxObstaclesInPool; i++) {
        const dino = createDinosaur();
        dino.visible = false;
        
        dino.userData = {
            active: false,
            speed: 0,
            direction: 'toward',
            randomOffset: 0,
            legL: dino.userData.legL,
            legR: dino.userData.legR
        };
        
        scene.add(dino);
        obstaclePool.push(dino);
    }
}

/**
 * Genera un dinosaurio obstáculo.
 */
function spawnObstacle() {
    const dino = obstaclePool.find(d => !d.userData.active);
    if (!dino) return;

    const lane = Math.floor(Math.random() * GameConfig.laneCount);
    const direction = Math.random() > 0.45 ? 'toward' : 'away';
    const relativeSpeed = (direction === 'toward') ? 3.5 : -2.5;

    dino.position.set(getLaneX(lane), 0, -GameConfig.roadLength);
    dino.rotation.y = (direction === 'toward') ? Math.PI : 0;
    dino.scale.set(0.9, 0.9, 0.9);

    if (dino.userData.legL) dino.userData.legL.rotation.x = 0;
    if (dino.userData.legR) dino.userData.legR.rotation.x = 0;

    dino.userData.active = true;
    dino.userData.speed = relativeSpeed;
    dino.userData.direction = direction;
    dino.userData.randomOffset = Math.random() * Math.PI * 2;
    dino.visible = true;

    obstacles.push(dino);
}

/**
 * Regresa un dinosaurio al pool
 */
function despawnObstacle(dino) {
    dino.visible = false;
    dino.userData.active = false;
    obstacles = obstacles.filter(o => o !== dino);
}

/**
 * Finaliza la partida por choque
 */
function triggerGameOver() {
    gameActive = false;
    document.getElementById('game-title').textContent = "FIN DEL JUEGO";
    document.getElementById('game-subtitle').textContent = `¡Chocaste! Recorriste ${Math.floor(distanceTraveled)}m.`;
    document.getElementById('btn-start').textContent = "REINTENTAR";
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
}

/**
 * Resetea el juego
 */
function resetGame() {
    distanceTraveled = 0;
    document.getElementById('score-value').textContent = "0m";

    obstacles.forEach(o => {
        o.visible = false;
        o.userData.active = false;
    });
    obstacles = [];

    currentLane = 2;
    targetX = getLaneX(currentLane);
    playerCar.position.set(targetX, 0, 0);
    playerCar.rotation.set(0, 0, 0);

    currentSpeed = GameConfig.defaultSpeed;
    targetSpeed = GameConfig.defaultSpeed;
    timeSinceLastSpawn = 0;

    gameActive = true;
}

/**
 * 4. Configuración de Controles
 */
function setupEvents() {
    window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    document.getElementById('btn-start').addEventListener('click', () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        resetGame();
    });

    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        switch (e.key) {
            case 'ArrowLeft': case 'a': case 'A':
                if (currentLane > 0) { currentLane--; targetX = getLaneX(currentLane); }
                break;
            case 'ArrowRight': case 'd': case 'D':
                if (currentLane < GameConfig.laneCount - 1) { currentLane++; targetX = getLaneX(currentLane); }
                break;
            case 'ArrowUp': case 'w': case 'W': targetSpeed = GameConfig.maxSpeed; break;
            case 'ArrowDown': case 's': case 'S': targetSpeed = GameConfig.minSpeed; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (!gameActive) return;
        if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S'].includes(e.key)) targetSpeed = GameConfig.defaultSpeed;
    });

    const container = document.getElementById('game-wrapper');
    container.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (!gameActive) return;
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > minSwipeDistance) {
                if (diffX > 0 && currentLane < GameConfig.laneCount - 1) { currentLane++; targetX = getLaneX(currentLane); }
                else if (diffX < 0 && currentLane > 0) { currentLane--; targetX = getLaneX(currentLane); }
            }
        } else if (Math.abs(diffY) > minSwipeDistance) {
            targetSpeed = diffY < 0 ? GameConfig.maxSpeed : GameConfig.minSpeed;
            setTimeout(() => targetSpeed = GameConfig.defaultSpeed, 1000);
        }
    }, { passive: true });
}

/**
 * 5. Ciclo de Animación
 */
let distanceTraveled = 0;

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (gameActive) {
        playerCar.position.x = THREE.MathUtils.lerp(playerCar.position.x, targetX, 12 * deltaTime);
        playerCar.rotation.z = THREE.MathUtils.lerp(playerCar.rotation.z, (targetX - playerCar.position.x) * -0.15, 8 * deltaTime);
        
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, playerCar.position.x, 10 * deltaTime);
        camera.lookAt(new THREE.Vector3(camera.position.x, 0.8, -10));

        currentSpeed = THREE.MathUtils.lerp(currentSpeed, targetSpeed, GameConfig.speedChangeRate * deltaTime);

        const playerDino = playerCar.children.find(c => c.userData && c.userData.legL);
        if (playerDino) {
            const swingAngle = Math.sin(time * 0.001 * (currentSpeed * 0.8)) * 0.25;
            playerDino.userData.legL.rotation.x = swingAngle;
            playerDino.userData.legR.rotation.x = -swingAngle;
        }

        timeSinceLastSpawn += deltaTime;
        if (timeSinceLastSpawn >= spawnInterval) {
            spawnObstacle();
            timeSinceLastSpawn = 0;
        }

        [...obstacles].forEach(dino => {
            dino.position.z += (currentSpeed + dino.userData.speed) * deltaTime;
            const legAngle = Math.sin(time * 0.001 * (dino.userData.direction === 'toward' ? 14 : 9) + dino.userData.randomOffset) * 0.45;
            if (dino.userData.legL) { dino.userData.legL.rotation.x = legAngle; dino.userData.legR.rotation.x = -legAngle; }

            if (dino.position.z > 6) { despawnObstacle(dino); return; }

            const playerBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(playerCar.position.x, 0.25, 0), new THREE.Vector3(0.65, 0.5, 1.25));
            const obstacleBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(dino.position.x, 0.35, dino.position.z), new THREE.Vector3(0.35, 0.7, 0.45));

            if (playerBox.intersectsBox(obstacleBox)) triggerGameOver();
        });

        laneLines.forEach(line => {
            line.position.z += currentSpeed * deltaTime;
            if (line.position.z > 5) line.position.z -= GameConfig.roadLength;
        });

        distanceTraveled += currentSpeed * deltaTime;
        document.getElementById('score-value').textContent = Math.floor(distanceTraveled) + "m";
    }
    renderer.render(scene, camera);
}

function getLaneX(laneIndex) {
    const roadWidth = GameConfig.laneCount * GameConfig.laneWidth;
    const startX = -roadWidth / 2 + GameConfig.laneWidth / 2;
    return startX + (laneIndex * GameConfig.laneWidth);
}
