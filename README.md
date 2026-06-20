# ♛ The Royal Study

Versión digital **en 3D** del clásico rompecabezas de ajedrez *The Royal Study*
(Philos). Resuelve estudios de ajedrez solitario capturando piezas hasta dejar
una sola, en el **mínimo número de jugadas**.

> Cada jugada **debe** capturar otra pieza. El estudio se resuelve cuando queda
> una única pieza en el tablero. El **Par** es el mínimo de jugadas posible:
> resolverlo en el par otorga puntos extra.

🔗 Repositorio: https://github.com/rmoya81/the-royal-study

## ✨ Características

- **Entorno 3D** con [Three.js](https://threejs.org): tablero de madera, piezas
  procedurales (rey, dama, alfil, caballo, torre, peón), iluminación con sombras
  suaves y cámara orbital.
- **24 estudios verificados** repartidos en 3 niveles (Aprendiz · Maestro · Gran
  Maestro). Todos los puzzles se generan y se comprueban como resolubles con un
  solver propio.
- **Ayudas de juego**: deshacer, reiniciar y pista (calcula la mejor jugada).
- **Optimizado**: geometrías reutilizadas, `pixelRatio` limitado, bundle
  minificado con Vite (~10 kB de lógica + Three.js en un chunk cacheable).
- **Responsive** y jugable con ratón o táctil.

## 🎮 Cómo jugar

1. Toca una pieza: sus capturas válidas se iluminan en oro.
2. Toca una casilla iluminada para capturar.
3. Repite hasta dejar **una sola pieza**.
4. Atajos: arrastrar = orbitar · rueda = zoom · `U` deshacer · `R` reiniciar ·
   `H` pista · `←`/`→` cambiar estudio.

## 🚀 Desarrollo

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción en dist/
npm run preview    # previsualizar el build
```

### Regenerar los estudios

Los puzzles viven en `src/game/puzzles.js` y se generan automáticamente:

```bash
node scripts/generate-puzzles.js
```

El generador coloca piezas al azar (con semilla fija para builds estables) y
solo conserva las posiciones que el solver confirma resolubles.

## 🗂️ Estructura

```
src/
├── main.js            Controlador: une reglas, 3D y la interfaz
├── style.css          Interfaz (HUD, barra de herramientas, modales)
├── game/
│   ├── engine.js      Reglas de ajedrez y validación de capturas
│   ├── solver.js      Solver DFS (validación + pistas)
│   └── puzzles.js     Estudios generados (auto)
└── three/
    ├── scene.js       Escena, cámara, luces, tablero, input
    └── pieces.js      Geometría procedural de las piezas
```

## 📦 Publicación

Al hacer *push* a `main`, el workflow de GitHub Actions
(`.github/workflows/deploy.yml`) compila el proyecto y lo publica en
**GitHub Pages**. Actívalo en *Settings → Pages → Source: GitHub Actions*.

## 📄 Licencia

[MIT](LICENSE) © rmoya81. Inspirado en *The Royal Study* de Philos; este es un
proyecto independiente sin afiliación con la marca.
