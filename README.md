# ♛ The Royal Study

Versión digital **en 3D** del rompecabezas de ajedrez *The Royal Study*
(Philos), fiel al reglamento original. En un tablero de **3×3**, recoloca las
piezas hasta que coincidan con la carta objetivo, en el **mínimo número de
jugadas** y antes de que se agote el **reloj de arena**.

> **No se captura**: las piezas solo se mueven a casillas vacías y no saltan
> sobre otras… excepto el caballo. El **alfil** permanece siempre en casillas
> oscuras y el **caballo** nunca puede ocupar la casilla central. El estudio se
> resuelve cuando cada pieza ocupa la silueta dorada que marca la carta.

🔗 Repositorio: https://github.com/rmoya81/the-royal-study

## ✨ Características

- **Entorno 3D** con [Three.js](https://threejs.org): tablero de madera 3×3,
  piezas procedurales ornamentadas (rey, dama, torre, alfil, caballo), siluetas
  doradas que marcan el objetivo de la carta, iluminación con sombras suaves y
  cámara orbital.
- **Reglamento fiel a Philos**: sin capturas, sin saltar (salvo el caballo),
  alfil en casillas oscuras, caballo fuera del centro, y **reloj de arena**.
- **Dos modos**: campaña en **solitario** (con giros/reflejos de carta en los
  niveles 2 y 3) y **2 jugadores con puja** (estimar jugadas, arrastre de
  posición entre rondas, gana quien llega a 6 puntos).
- **24 estudios verificados** en 3 niveles (Aprendiz · Maestro · Gran Maestro).
  Cada estudio (posición inicial + objetivo) se genera y el **mínimo de jugadas
  (par)** se calcula con un solver BFS propio.
- **Ayudas de juego**: deshacer, reiniciar y pista (calcula la mejor jugada).
- **Optimizado**: geometrías reutilizadas, `pixelRatio` limitado, bundle
  minificado con Vite (~10 kB de lógica + Three.js en un chunk cacheable).
- **Responsive** y jugable con ratón o táctil.

## 🎮 Cómo jugar

1. Toca una pieza: sus movimientos legales se iluminan en verde.
2. Toca una casilla iluminada para mover (a casilla vacía; no se captura).
3. Coloca cada pieza sobre su **silueta dorada** antes de que caiga el reloj.
4. Iguala el **mínimo de jugadas** para ganar +2 puntos (si no, +1).
5. Atajos: arrastrar = orbitar · rueda = zoom · `U` deshacer · `R` reiniciar ·
   `H` pista · `←`/`→` cambiar estudio.

### Niveles y transformaciones de carta

- **Aprendiz**: reglas básicas.
- **Maestro**: puedes **girar** la carta (↺ ↻). Cada giro de 90° cuesta 1
  jugada (180° = 2). El mínimo ya cuenta el giro óptimo.
- **Gran Maestro**: además puedes **reflejar** la carta (⇄ ⇅), cada reflejo
  cuesta 1 jugada. En estos niveles, transformar la carta **siempre forma parte
  de la solución óptima** — encontrar la orientación adecuada es el reto.

### Modo 2 Jugadores (puja)

Pulsa **«2 Jugadores»** en la cabecera. Por ronda:

1. El **Jugador 1** apuesta en cuántas jugadas resolverá la carta.
2. El **Jugador 2** puede **aceptar** el reto o **apostar menos**.
3. Quien tenga la apuesta **más baja** debe resolverlo dentro de esas jugadas
   (con el reloj de arena). Si lo logra, gana el punto; si no, el punto es para
   el rival (también puede **rendirse**).
4. Las piezas **se quedan** donde acaben y se reparte una nueva carta.
5. Gana quien llega primero a **6 puntos**.

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

El generador crea una posición inicial válida, genera el objetivo mediante un
paseo aleatorio de movimientos legales (lo que garantiza que es alcanzable) y el
solver BFS calcula el mínimo de jugadas. La semilla es fija para builds estables.

## 🗂️ Estructura

```
src/
├── main.js            Controlador: une reglas, 3D y la interfaz
├── style.css          Interfaz (HUD, barra de herramientas, modales)
├── game/
│   ├── engine.js      Reglas (3×3, sin capturas, alfil/caballo especiales)
│   ├── solver.js      Solver BFS (mínimo de jugadas + pistas)
│   └── puzzles.js     Estudios generados: posición inicial + objetivo (auto)
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
