/**
 * Cyber Autito - game.js (Fase 1: Configuración del Lienzo 3D)
 * 
 * En este archivo inicializaremos Three.js. Three.js es un motor 3D
 * que facilita la interacción con la API WebGL del navegador.
 * WebGL permite renderizar gráficos 3D directamente en la GPU del celular o PC.
 */

// --- CONFIGURACIÓN GLOBAL DEL JUEGO ---
const GameConfig = {
    // Definimos el número de carriles de forma variable. 
    // Si en el futuro queremos 3, 5, 7 o 9 carriles, solo cambiamos este valor.
    laneCount: 5, 
    
    // Ancho de cada carril en unidades de Three.js (generalmente tomadas como metros)
    laneWidth: 1.6, 
    
    // Largo de la sección de carretera visible
    roadLength: 100,
    
    // Velocidad de simulación por defecto (en unidades por segundo)
    defaultSpeed: 10
};

// --- VARIABLES DE LÓGICA DE JUEGO Y THREE.JS ---
let scene, camera, renderer;
let roadPlane;
let laneLines = []; // Guardará las líneas blancas que dividen los carriles
let gameActive = false;

// Al cargar el DOM (documento HTML), inicializamos nuestro escenario 3D.
window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    createWorld();
    setupEvents();
    
    // Iniciamos el ciclo del juego (Game Loop)
    animate();
});

/**
 * 1. Inicialización del Motor de Render (Three.js)
 */
function initEngine() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // A. CREAR LA ESCENA: Es el espacio tridimensional donde viven todos nuestros objetos, luces y cámaras.
    scene = new THREE.Scene();
    
    // Añadimos un color de fondo gris oscuro para la estética inicial de "Programmer Art"
    scene.background = new THREE.Color(0x222222);

    // B. CREAR LA CÁMARA: Define desde dónde vemos el mundo.
    // Usamos una cámara de perspectiva (PerspectiveCamera) para imitar el ojo humano (las cosas lejanas se ven más pequeñas).
    // Parámetros: FOV (Campo de visión en grados), Relación de Aspecto, Near Clip (distancia mínima), Far Clip (distancia máxima)
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    
    // Posicionamos la cámara detrás de donde estará el auto (tercera persona)
    // X = 0 (centrado), Y = 4 (elevado del suelo para ver el panorama), Z = 8 (detrás del origen Z = 0)
    camera.position.set(0, 3.5, 7);
    
    // Hacemos que la cámara mire hacia adelante, un poco más arriba de la carretera
    camera.lookAt(new THREE.Vector3(0, 1, -15));

    // C. CREAR EL RENDERIZADOR (Renderer): Es el que dibuja la escena en la pantalla.
    // Activamos antialias para suavizar los bordes pixelados.
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    
    // Configuramos el renderizador para dispositivos de alta densidad (pantallas Retina/móviles)
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Insertamos el elemento Canvas creado por Three.js en nuestro contenedor HTML
    container.appendChild(renderer.domElement);

    // D. LUCES: Sin luz, todo se vería negro.
    // Luz ambiental: Ilumina todos los objetos por igual desde todas las direcciones (evita sombras absolutas).
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Luz Direccional: Imita la luz del sol. Proviene de una dirección y genera relieve al iluminar caras inclinadas.
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
}

/**
 * 2. Creación de Objetos 3D (El Mundo)
 */
function createWorld() {
    // Calculamos el ancho total de la carretera en base al número de carriles
    const roadWidth = GameConfig.laneCount * GameConfig.laneWidth;

    // A. CARRETERA (Plano Gris)
    // PlaneGeometry representa un plano plano de 2D en el espacio 3D.
    // Parámetros: Ancho, Largo
    const roadGeo = new THREE.PlaneGeometry(roadWidth, GameConfig.roadLength);
    
    // MeshStandardMaterial reacciona a la luz de forma realista.
    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x444444, // Gris asfalto
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Un Mesh combina una Geometría (forma) y un Material (aspecto/color)
    roadPlane = new THREE.Mesh(roadGeo, roadMat);
    
    // Por defecto los planos se crean verticales. Lo rotamos 90 grados en el eje X para que quede plano en el suelo.
    roadPlane.rotation.x = -Math.PI / 2;
    roadPlane.position.z = -GameConfig.roadLength / 2; // Desplazamos la carretera hacia adelante
    scene.add(roadPlane);

    // B. LÍNEAS DIVISORIAS DE CARRILES (Programmer Art)
    // Dibujamos líneas blancas punteadas entre cada carril para marcar los límites.
    const startX = -roadWidth / 2;
    
    for (let i = 1; i < GameConfig.laneCount; i++) {
        // La coordenada X del límite del carril
        const lineX = startX + (i * GameConfig.laneWidth);
        
        // Creamos una línea blanca para este límite
        // Usamos una caja muy delgada y plana para simular una marca vial en 3D
        const lineGeo = new THREE.BoxGeometry(0.08, 0.01, GameConfig.roadLength);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xcccccc }); // Blanco simple
        
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(lineX, 0.005, -GameConfig.roadLength / 2); // Un poco elevado para evitar z-fighting (parpadeo de texturas pegadas)
        scene.add(line);
        laneLines.push(line);
    }

    // C. BORDES DE CARRETERA (Líneas rojas de programador para enmarcar el mapa)
    const borderGeo = new THREE.BoxGeometry(0.15, 0.1, GameConfig.roadLength);
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xff3333 }); // Rojo
    
    // Borde Izquierdo
    const leftBorder = new THREE.Mesh(borderGeo, borderMat);
    leftBorder.position.set(-roadWidth / 2, 0.05, -GameConfig.roadLength / 2);
    scene.add(leftBorder);

    // Borde Derecho
    const rightBorder = new THREE.Mesh(borderGeo, borderMat);
    rightBorder.position.set(roadWidth / 2, 0.05, -GameConfig.roadLength / 2);
    scene.add(rightBorder);
}

/**
 * 3. Configuración de Eventos (Redimensionamiento y Botones)
 */
function setupEvents() {
    // Manejo de redimensionamiento de pantalla. 
    // Si el usuario rota el teléfono o cambia el tamaño de la ventana en PC, ajustamos la cámara.
    window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Actualizamos la relación de aspecto de la cámara
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        // Actualizamos el tamaño del lienzo de renderizado
        renderer.setSize(width, height);
    });

    // Acción del botón JUGAR en el Menú Principal
    document.getElementById('btn-start').addEventListener('click', () => {
        // Ocultamos el menú principal y mostramos el HUD
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        gameActive = true;
        console.log("¡Partida Iniciada! Estado: PLAYING");
    });
}

/**
 * 4. El Ciclo de Juego (Game Loop)
 * Esta función se ejecuta unas 60 veces por segundo (60 FPS) usando requestAnimationFrame.
 * Se encarga de actualizar posiciones y redibujar la escena constantemente.
 */
function animate() {
    // Solicita al navegador ejecutar esta función de nuevo en el próximo fotograma
    requestAnimationFrame(animate);
    
    // Si el juego está activo, simulamos el movimiento
    if (gameActive) {
        // En la Fase 1, simplemente dejamos la cámara quieta y el juego activo.
        // Podríamos imprimir la distancia recorrida en el HUD para ver que algo ocurre
        let distance = parseFloat(document.getElementById('score-value').textContent);
        distance += 0.1; // Sumamos distancia de forma ficticia
        document.getElementById('score-value').textContent = Math.floor(distance) + "m";
    }

    // Renderizamos la escena con la cámara
    renderer.render(scene, camera);
}

/**
 * FUNCIÓN DE AYUDA (Para Fase 2): Calcula el valor de la posición X
 * de un carril en base a su índice (0 a laneCount - 1).
 */
function getLaneX(laneIndex) {
    const roadWidth = GameConfig.laneCount * GameConfig.laneWidth;
    const startX = -roadWidth / 2 + GameConfig.laneWidth / 2;
    return startX + (laneIndex * GameConfig.laneWidth);
}
