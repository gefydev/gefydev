# Widgets de perfil propios ("Gefy Glass")

Generador sin dependencias (Node 20+, solo `fetch` y `node:test`) que consulta la API GraphQL de GitHub y escribe los SVG del README. Reemplaza a `github-readme-stats`, `github-pr-stats`, `streak-stats`, `capsule-render`, `readme-typing-svg`, `skillicons` y los badges de shields. Diseño de Davinci (`Shared/gh-profile-widgets/diseno/`), portado a módulos.

```
widgets/
  config.json        usuario, stack, límites
  3d-settings.json   paleta de marca (dark/light) para github-profile-3d-contrib
  assets/            logos (simple-icons, CC0)
  src/
    github.js        cliente GraphQL (reintentos, paginación) y fetchProfile
    avatars.js       descarga avatares como data: URI (solo hosts de GitHub, tipos de imagen, <= 12 KB)
    compute.js       cálculos puros: racha, lenguajes, PRs por repo, stats
    model.js         arma el contrato de datos del diseño (forma de test/fixtures/sample.json)
    glass.js         plantillas SVG (hero, stack, prs, stats, langs, streak) + variantes móviles + marco para el 3D y la snake
    index.js         orquestador y CLI; DEFINITIONS (qué cuenta cada número)
  test/              node --test (SVG con datos vacíos, enormes y hostiles)
```

## Uso

```
cd widgets && npm test
GITHUB_TOKEN=... node src/index.js --out dist                 # consulta la API
node src/index.js --out dist --fixture raw.json               # sin red, desde datos guardados
node src/index.js --out dist --save-raw raw.json              # guarda lo consultado
node src/index.js --out dist --fixture raw.json --sample      # con la marca "DATOS DE EJEMPLO"
```

Salida: `<widget>-{dark,light}.svg` (escritorio, hasta 850 px), `<widget>-m-{dark,light}.svg` (móvil, 340 px, todos los widgets) y `data.json`. El encabezado es estático (`assets/hero/`, diseño de Davinci) y se publica tal cual.

## Definición única de los números

Todos los widgets salen de la misma consulta y de las mismas funciones de `compute.js`; la definición viaja en `data.json`.

- **PRs (titular y widget por repo):** creados por la cuenta en repositorios **públicos ajenos** (de otras personas u organizaciones), en todos los estados. Los PRs en repos propios se muestran aparte como dato chico ("+ N in own repositories").
- **Repos del widget:** ordenados por PRs mergeados (desempate: PR más reciente), máximo 6, cada uno con sus 3 PRs más recientes por fecha de creación.
- **Commits:** públicos de los últimos 12 meses.
- **Estrellas:** repos públicos propios que no son forks. **Lenguajes:** bytes en esos mismos repos.
- **Racha:** días consecutivos con alguna contribución; el día en curso sin contribuciones todavía no corta la racha. Coincide con `streak-stats`.
- **Privados:** PRs, repos, lenguajes y estrellas usan solo repos públicos; nunca aparecen nombres, títulos ni lenguajes privados. No hay PAT: la Action usa solo `GITHUB_TOKEN`. **Excepción conocida:** la racha, el total de contribuciones y el gráfico 3D salen del calendario de contribuciones de GitHub, que incluye contribuciones privadas anonimizadas (solo cantidades, sin nombres) si el perfil tiene activado "Include private contributions on my profile"; es el mismo número que ya muestra el perfil público.

## Publicación

`.github/workflows/profile-widgets.yml` corre cada 6 h, a mano (`workflow_dispatch`) y en cada push a `main`: tests, 3D (`github-profile-3d-contrib`, paleta de `3d-settings.json`), snake (`platane/snk`), widgets, y publica todo como un único commit en la rama `widgets-output` (se reescribe cada vez: el historial de `main` no crece). Todas las acciones están fijadas por SHA. Si la generación del 3D o de la snake falla, se conservan los SVG anteriores. El README referencia `https://raw.githubusercontent.com/gefydev/gefydev/widgets-output/...`. El cron solo se activa cuando el workflow está en la rama por defecto. `snake.yml` y la rama `output` quedan obsoletos (la snake ahora se genera acá).

## 3D y snake dentro del marco de vidrio

Son SVG de terceros; se componen en `glass.js` (`3d-*.svg` y `snake-*.svg`, con variante móvil `-m`):

- **3D:** se conservan solo el gráfico isométrico y su paleta (que sale de `3d-settings.json`: niveles teal → azul → violeta, dark y light); el radar y el donut se descartan porque repiten datos que ya tienen sus widgets (y el radar cuenta los PRs de otra forma). El total de contribuciones y la leyenda Less/More se rehacen con el estilo del sistema. En móvil se quitan las animaciones de crecimiento.
- **Snake:** se prefijan sus clases y animaciones (`c`, `u`, `s` chocarían con las del marco) y se reemplaza su paleta por la de marca según el tema.
- Se incrustan en línea (no como `<image>`), porque pesan menos comprimidos: ~8 KB el 3D y ~11 KB la snake (servidos con gzip).

## Caché de las imágenes

Medido en github.com con el README de la rama: las imágenes de `raw.githubusercontent.com` del mismo repositorio se cargan **directo desde `raw.githubusercontent.com`, no a través de `camo`** (solo las de terceros, como el contador de visitas, pasan por `camo`). `raw` responde `Cache-Control: max-age=300`, así que un SVG nuevo se ve en el README en unos 5 minutos (más el caché del navegador), contra las 24 h de `max-age=86400` que mandaba `github-readme-stats`. Eso explica el "57" viejo. Verificado en la vista de archivo de la rama; no se pudo verificar en la página de perfil `github.com/gefydev` porque muestra el README de `main`, que este PR no toca.

## Responsive

El README elige con `<picture>`: hasta 1011 px de ancho de pantalla usa la variante móvil de 340 px (con la barra lateral de GitHub, a 768 px el README mide 398 px). Entre 1012 y 1279 px se ve la de escritorio reducida y su texto más chico queda por debajo de 11 px. Desde la rama de un PR, el workflow publica en `widgets-preview`; solo `main` escribe `widgets-output`.

## Cambiar el diseño

Cada widget es una función `(datos, tema) -> SVG` en `glass.js`; los temas (`THEMES`) y tamaños están ahí. Los cálculos y el contrato de datos (`model.js`) no se tocan. `test/svg.test.js` valida el XML de todos los widgets × temas × tamaños con datos de ejemplo, vacíos, enormes y hostiles.
