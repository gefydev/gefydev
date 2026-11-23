# Widgets de perfil propios ("Gefy Glass")

Generador sin dependencias (Node 20+, solo `fetch` y `node:test`) que consulta la API GraphQL de GitHub y escribe los SVG del README. Reemplaza a `github-readme-stats`, `github-pr-stats`, `streak-stats`, `capsule-render`, `readme-typing-svg`, `skillicons` y los badges de shields. Diseño de Davinci (`Shared/gh-profile-widgets/diseno/`), portado a módulos.

```
widgets/
  config.json        usuario, textos del hero, stack, límites
  assets/            logos (simple-icons, CC0)
  src/
    github.js        cliente GraphQL (reintentos, paginación) y fetchProfile
    avatars.js       descarga avatares como data: URI (solo hosts de GitHub, tipos de imagen, <= 12 KB)
    compute.js       cálculos puros: racha, lenguajes, PRs por repo, stats
    model.js         arma el contrato de datos del diseño (forma de test/fixtures/sample.json)
    glass.js         plantillas SVG (hero, stack, prs, stats, langs, streak) + variantes móviles
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

Salida: `<widget>-{dark,light}.svg` (escritorio, hasta 850 px), `<widget>-m-{dark,light}.svg` (móvil, 420 px; hero, stack, prs y streak), `stats` y `langs` (420 px, sirven en ambos) y `data.json`.

## Definición única de los números

Todos los widgets salen de la misma consulta y de las mismas funciones de `compute.js`; la definición viaja en `data.json`.

- **PRs (titular y widget por repo):** creados por la cuenta en repositorios **públicos ajenos** (de otras personas u organizaciones), en todos los estados. Los PRs en repos propios se muestran aparte como dato chico ("+ N in own repositories").
- **Repos del widget:** ordenados por PRs mergeados (desempate: PR más reciente), máximo 6, cada uno con sus 3 PRs más recientes por fecha de creación.
- **Commits:** públicos de los últimos 12 meses.
- **Estrellas:** repos públicos propios que no son forks. **Lenguajes:** bytes en esos mismos repos.
- **Racha:** días consecutivos con alguna contribución; el día en curso sin contribuciones todavía no corta la racha. Coincide con `streak-stats`.
- **Privados:** no se usan en ningún número ni aparecen nombres, títulos o lenguajes privados, aunque el token los vea. No hay PAT: la Action usa `GITHUB_TOKEN`.

## Publicación

`.github/workflows/profile-widgets.yml` corre cada 6 h, a mano (`workflow_dispatch`) y en cada push a `main`: tests, 3D (`github-profile-3d-contrib` fijado por SHA), widgets, y publica todo como un único commit en la rama `widgets-output` (se reescribe cada vez: el historial de `main` no crece). Si la generación del 3D falla, se conservan los SVG anteriores. El README referencia `https://raw.githubusercontent.com/gefydev/gefydev/widgets-output/...`. `snake.yml` sigue publicando en la rama `output`, con las acciones fijadas por SHA. El cron solo se activa cuando el workflow está en la rama por defecto.

## Caché de las imágenes

Medido en github.com con el README de la rama: las imágenes de `raw.githubusercontent.com` del mismo repositorio se cargan **directo desde `raw.githubusercontent.com`, no a través de `camo`** (solo las de terceros, como el contador de visitas, pasan por `camo`). `raw` responde `Cache-Control: max-age=300`, así que un SVG nuevo se ve en el README en unos 5 minutos (más el caché del navegador), contra las 24 h de `max-age=86400` que mandaba `github-readme-stats`. Eso explica el "57" viejo. Verificado en la vista de archivo de la rama; no se pudo verificar en la página de perfil `github.com/gefydev` porque muestra el README de `main`, que este PR no toca.

## Responsive

En móvil un SVG de 850 px se escala a ~0.4 y el texto queda ilegible, así que hero, stack, prs y streak tienen una variante de 420 px. El README elige con `<picture>` y una media query: `(prefers-color-scheme: dark) and (max-width: 600px)`.

## Cambiar el diseño

Cada widget es una función `(datos, tema) -> SVG` en `glass.js`; los temas (`THEMES`) y tamaños están ahí. Los cálculos y el contrato de datos (`model.js`) no se tocan. `test/svg.test.js` valida el XML de todos los widgets × temas × tamaños con datos de ejemplo, vacíos, enormes y hostiles.
