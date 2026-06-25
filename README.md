# Cyber Autito - Juego de Conducción 3D (Subway Surfers Style)

hola:)

Un juego de conducción en 3D en tercera persona desarrollado con tecnologías web nativas y diseñado con un enfoque móvil-primero (mobile-first). El jugador conduce un auto esquivando obstáculos y recolectando monedas en una autopista de carriles variables.

Este proyecto está planteado de forma educativa para aprender desarrollo de videojuegos paso a paso.

---

## 🚀 Características Actuales (Fases 1 y 2 Completadas)
*   **Motor 3D Nativo**: Renderizado de gráficos 3D mediante **Three.js** y WebGL para un alto rendimiento (60 FPS).
*   **Diseño Adaptable (Mobile-First)**: Interfaz vertical optimizada para pantallas móviles, con previsualización centrada en computadoras de escritorio.
*   **Carretera Parametrizada**: Estructura de carriles configurable por variable (`laneCount = 5`). La autopista y marcas se dibujan automáticamente según los parámetros establecidos.
*   **Modelo de Auto 3D**: Auto deportivo creado programáticamente mediante primitivas de Three.js (chasis, cabina, faros y ruedas).
*   **Controles Dinámicos Híbridos**: Soporte de teclado (WASD / Flechas) y gestos táctiles en móviles (deslizar) con respuesta inmediata.
*   **Movimiento Suave (Lerp)**: Transición horizontal lateral suave entre carriles e inclinación del chasis al girar.
*   **HUD en Tiempo Real**: Marcador de distancia recorrida calculada según la velocidad actual del jugador.

---

## 🛠️ Cómo Ejecutar el Proyecto Localmente

Para iniciar el servidor local y jugar en tu navegador, necesitas tener Python instalado. Sigue estos pasos:

1.  Abre la terminal en la carpeta del proyecto.
2.  Inicia el servidor web ejecutando el siguiente comando:
    ```bash
    py -m http.server 3000
    ```
3.  Abre tu navegador de internet favorito y accede a:
    👉 [**http://localhost:3000**](http://localhost:3000)

---

## 📅 Roadmap de Desarrollo

El desarrollo está organizado en 6 fases progresivas:

*   **[x] Fase 1**: Configuración del Lienzo 3D, cámara de perspectiva y autopista multi-carril. (Completado)
*   **[x] Fase 2**: Modelado del auto en 3D (programmer art) y controles táctiles de deslizamiento (swipe) + teclado. (Completado)
*   **[ ] Fase 3**: Carretera infinita en movimiento, generación aleatoria de obstáculos/monedas y colisiones AABB.
*   **[ ] Fase 4**: Bucle y estados de juego (Inicio, HUD, Game Over, Tienda) y poderes especiales (Salto, Nitro, Imán, Escudo).
*   **[ ] Fase 5**: Tienda de mejoras (Garaje) para comprar/mejorar poderes usando monedas recolectadas, y guardado local.
*   **[ ] Fase 6**: Optimización PWA (instalable en móviles sin conexión) y ganchos para un ranking multijugador online.

---

## 📦 Tecnologías Utilizadas
*   **HTML5** (Estructura y UI)
*   **CSS3** (Estilos y responsividad)
*   **JavaScript** (Lógica de juego y física)
*   **Three.js** (Motor de renderizado 3D WebGL)
