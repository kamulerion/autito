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
let cameraMode = 'follow'; // Modos: 'follow' (sigue al auto) o 'road' (fija en el centro de la calle)

// Variables para gestos táctiles (móviles)
let touchStartX = 0;
let touchStartY = 0;
const minSwipeDistance = 30; // Distancia mínima en píxeles para reconocer un deslizamiento (swipe)

// Al cargar el documento, inicializamos el juego
window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    createWorld();
    createPlayerCar();
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
 * 3. Modelado del Auto del Jugador (Basic Programmer Art)
 * Creamos un auto compuesto por cajas y cilindros sencillos agrupados.
 */
function createPlayerCar() {
    // Un THREE.Group nos permite agrupar múltiples objetos 3D y moverlos/rotarlos como una sola unidad.
    playerCar = new THREE.Group();

    // A. Chasis Principal (El cuerpo bajo del coche) - Caja azul
    const chassisGeo = new THREE.BoxGeometry(0.8, 0.25, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 }); // Azul
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.15; // Un poco elevado del suelo para las ruedas
    playerCar.add(chassis);

    // B. Cabina (El habitáculo donde va el piloto) - Caja negra/cristal
    const cabinGeo = new THREE.BoxGeometry(0.65, 0.25, 0.7);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2 }); // Gris oscuro brillante
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.35, 0.1); // Sobre el chasis y ligeramente hacia atrás
    playerCar.add(cabin);

    // C. Ruedas (4 cilindros negros)
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); // Negro goma
    
    // Posiciones relativas para las 4 ruedas
    const wheelPositions = [
        { x: -0.45, y: 0.2, z: 0.45 },  // Delantera Izquierda
        { x: 0.45, y: 0.2, z: 0.45 },   // Delantera Derecha
        { x: -0.45, y: 0.2, z: -0.45 }, // Trasera Izquierda
        { x: 0.45, y: 0.2, z: -0.45 }   // Trasera Derecha
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(pos.x, pos.y, pos.z);
        // Los cilindros se crean verticales por defecto, los rotamos en Z para que rueden de adelante a atrás
        wheel.rotation.z = Math.PI / 2;
        playerCar.add(wheel);
    });

    // D. Faros delanteros (Dos cubos amarillos pequeños que brillan)
    const lightGeo = new THREE.BoxGeometry(0.12, 0.08, 0.05);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Amarillo auto-iluminado
    
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.position.set(-0.25, 0.18, 0.7);
    playerCar.add(leftLight);

    const rightLight = new THREE.Mesh(lightGeo, lightMat);
    rightLight.position.set(0.25, 0.18, 0.7);
    playerCar.add(rightLight);

    // Posición inicial del auto: carril central (índice 2), en el origen Z = 0
    targetX = getLaneX(currentLane);
    playerCar.position.set(targetX, 0, 0);
    
    scene.add(playerCar);
}

/**
 * 4. Configuración de Controles (Teclado y Táctil Móvil)
 */
function setupEvents() {
    // Redimensionamiento de pantalla
    window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Botón JUGAR del menú
    document.getElementById('btn-start').addEventListener('click', () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        gameActive = true;
    });

    // Botón de cambio de cámara
    document.getElementById('btn-camera').addEventListener('click', () => {
        const btn = document.getElementById('btn-camera');
        if (cameraMode === 'follow') {
            cameraMode = 'road';
            btn.textContent = 'CAM: CALLE';
        } else {
            cameraMode = 'follow';
            btn.textContent = 'CAM: AUTO';
        }
    });

    // --- CONTROLES DE TECLADO ---
    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;

        switch (e.key) {
            // Cambio de carril a la izquierda
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (currentLane > 0) {
                    currentLane--;
                    targetX = getLaneX(currentLane);
                }
                break;
            // Cambio de carril a la derecha
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (currentLane < GameConfig.laneCount - 1) {
                    currentLane++;
                    targetX = getLaneX(currentLane);
                }
                break;
            // Acelerar (presión única o mantener presionado)
            case 'ArrowUp':
            case 'w':
            case 'W':
                targetSpeed = GameConfig.maxSpeed;
                break;
            // Desacelerar / Frenar
            case 'ArrowDown':
            case 's':
            case 'S':
                targetSpeed = GameConfig.minSpeed;
                break;
        }
    });

    // Retornar a la velocidad crucero normal cuando se sueltan las teclas de aceleración/freno
    window.addEventListener('keyup', (e) => {
        if (!gameActive) return;
        
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' ||
            e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            targetSpeed = GameConfig.defaultSpeed;
        }
    });

    // --- CONTROLES TÁCTILES (MÓVIL - SWIPES/DESLIZAMIENTOS) ---
    const container = document.getElementById('game-wrapper');

    container.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        // Guardamos el punto de inicio del toque en pantalla (coordenadas X, Y)
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        if (!gameActive) return;
        
        // Coordenadas donde se levantó el dedo
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        // Calculamos la distancia del desplazamiento en ambos ejes
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Determinamos si el gesto fue más horizontal o más vertical
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Gesto Horizontal
            if (Math.abs(diffX) > minSwipeDistance) {
                if (diffX > 0) {
                    // Deslizó a la derecha -> Mover a carril derecho
                    if (currentLane < GameConfig.laneCount - 1) {
                        currentLane++;
                        targetX = getLaneX(currentLane);
                    }
                } else {
                    // Deslizó a la izquierda -> Mover a carril izquierdo
                    if (currentLane > 0) {
                        currentLane--;
                        targetX = getLaneX(currentLane);
                    }
                }
            }
        } else {
            // Gesto Vertical
            if (Math.abs(diffY) > minSwipeDistance) {
                if (diffY < 0) {
                    // Deslizó hacia arriba -> Acelerar temporalmente
                    targetSpeed = GameConfig.maxSpeed;
                    // Programamos que vuelva a la velocidad por defecto en un segundo
                    setTimeout(() => {
                        if (targetSpeed === GameConfig.maxSpeed) {
                            targetSpeed = GameConfig.defaultSpeed;
                        }
                    }, 1000);
                } else {
                    // Deslizó hacia abajo -> Desacelerar temporalmente
                    targetSpeed = GameConfig.minSpeed;
                    setTimeout(() => {
                        if (targetSpeed === GameConfig.minSpeed) {
                            targetSpeed = GameConfig.defaultSpeed;
                        }
                    }, 1000);
                }
            }
        }
    }, { passive: true });
}

/**
 * 5. Ciclo de Animación y Actualización (Game Loop)
 */
let distanceTraveled = 0;

function animate(time) {
    requestAnimationFrame(animate);

    // Calculamos el deltaTime: tiempo transcurrido desde el último fotograma en segundos
    // Esto asegura que la velocidad del juego sea idéntica en cualquier pantalla (60hz, 120hz, etc.)
    const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // Limitamos a 0.1 para evitar saltos gigantescos si hay lag
    lastTime = time;

    if (gameActive) {
        // A. INTERPOLACIÓN HORIZONTAL DE CARRIL (LERP)
        // La interpolación lineal (Lerp) calcula un punto intermedio entre la posición actual y la objetivo.
        // Fórmula básica: actual = actual + (objetivo - actual) * factor_velocidad
        // Esto hace que el auto no aparezca de golpe en el nuevo carril, sino que se desplace suavemente.
        const lerpFactor = 12 * deltaTime; // Ajusta el '12' para hacer el cambio más rápido o más lento
        playerCar.position.x = THREE.MathUtils.lerp(playerCar.position.x, targetX, lerpFactor);

        // B. ROTACIÓN SUTIL AL GIRAR (Inclinación visual deportiva)
        // Hacemos que el auto se incline ligeramente sobre el eje Z hacia el carril al que se dirige.
        const targetRotationZ = (targetX - playerCar.position.x) * -0.15;
        playerCar.rotation.z = THREE.MathUtils.lerp(playerCar.rotation.z, targetRotationZ, 8 * deltaTime);

        // C. CONTROL DE LA CÁMARA (Según el modo activo)
        // Si el modo es 'follow', la cámara sigue la X del auto. Si es 'road', se mantiene en X = 0 (centro de la autopista).
        // Usamos un lerp suave (factor 10) para que la transición entre modos y el seguimiento sean limpios y fluidos.
        const targetCamX = (cameraMode === 'follow') ? playerCar.position.x : 0;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 10 * deltaTime);
        camera.lookAt(new THREE.Vector3(camera.position.x, 0.8, -10));

        // D. CONTROL DE VELOCIDAD
        // Interpolamos la velocidad actual hacia la velocidad objetivo (acelerando o frenando con inercia)
        currentSpeed = THREE.MathUtils.lerp(currentSpeed, targetSpeed, GameConfig.speedChangeRate * deltaTime);

        // E. SIMULACIÓN DE AVANCE (Scrolling del Escenario)
        // En lugar de mover el auto hacia adelante de forma infinita (lo que causaría que las coordenadas 3D
        // crecieran tanto que perderían precisión), dejamos el auto fijo en Z = 0 y movemos el escenario hacia ATRÁS.
        const scrollAmount = currentSpeed * deltaTime;
        
        // Movemos las líneas de los carriles hacia atrás (Z positivo)
        laneLines.forEach(line => {
            line.position.z += scrollAmount;
            
            // Si una línea pasa por detrás del auto (Z > 5), la reposicionamos al inicio de la carretera (Z = -roadLength)
            // Esto crea un bucle infinito de carretera sin consumir memoria adicional.
            if (line.position.z > 5) {
                line.position.z -= GameConfig.roadLength;
            }
        });

        // E. CONTABILIZAR DISTANCIA
        // La distancia recorrida aumenta según la velocidad actual
        distanceTraveled += scrollAmount;
        document.getElementById('score-value').textContent = Math.floor(distanceTraveled) + "m";
    }

    renderer.render(scene, camera);
}

/**
 * FUNCIÓN AUXILIAR: Calcula la posición X del centro de un carril.
 * Para 5 carriles y ancho de carril 1.6:
 * Carril 0: X = -3.2 (Extremo Izquierdo)
 * Carril 1: X = -1.6
 * Carril 2: X = 0.0 (Centro)
 * Carril 3: X = 1.6
 * Carril 4: X = 3.2 (Extremo Derecho)
 */
function getLaneX(laneIndex) {
    const roadWidth = GameConfig.laneCount * GameConfig.laneWidth;
    const startX = -roadWidth / 2 + GameConfig.laneWidth / 2;
    return startX + (laneIndex * GameConfig.laneWidth);
}

