# Widgets de perfil propios

Generador sin dependencias (Node 20+, solo `fetch` y `node:test`) que consulta la API GraphQL de GitHub y escribe SVG. Reemplaza a `github-readme-stats`, `github-pr-stats` y `streak-stats`.

```
widgets/
  config.json        usuario, privados, límites
  src/
    github.js        cliente GraphQL (reintentos, paginación) y fetchProfile
    compute.js       cálculos puros: racha, lenguajes, PRs por repo, stats
    index.js         orquestador y CLI; define DEFINITIONS (qué cuenta cada número)
    svg/
      theme.js       colores y tipografías (un solo lugar para el diseño)
      kit.js         escape XML, medición y recorte de texto, marco de tarjeta
      stats.js languages.js streak.js prs.js   una plantilla por widget
  test/              node --test
```

## Uso

```
cd widgets && npm test
GITHUB_TOKEN=... node src/index.js --out dist            # consulta la API
node src/index.js --out dist --fixture raw.json          # sin red, desde datos guardados
node src/index.js --out dist --save-raw raw.json         # guarda lo consultado
```

Salida en `dist/`: `stats.svg`, `languages.svg`, `streak.svg`, `prs.svg` y `data.json` (todo lo calculado, para diseñar o depurar).

## Definición única de los números

Todos los widgets salen de la misma consulta y de las mismas funciones de `compute.js`; el texto de cada definición viaja en `data.json`.

- **PRs:** creados por la cuenta en cualquier repositorio **público**, propio o ajeno, en todos los estados. Los repos privados no entran en los totales aunque el token los vea (así el número no cambia según el token). Desglose: repos ajenos vs propios; mergeados, abiertos, cerrados.
- **Commits:** públicos de los últimos 12 meses.
- **Estrellas:** repos públicos propios que no son forks.
- **Lenguajes:** bytes en repos propios no forks.
- **Racha:** días consecutivos con alguna contribución; el día en curso sin contribuciones todavía no corta la racha. Coincide con `streak-stats` (verificado: mismas cifras y fechas).

## Privados

`includePrivate` en `config.json`:

- `off` (por defecto): no se usa nada de repos privados.
- `aggregate`: requiere un token que vea esos repos. Se agrega una línea "+N PRs in private repositories" y los lenguajes privados suman a los porcentajes. Nunca se publican nombres, títulos ni URLs privadas.

Token: la Action usa `secrets.PROFILE_STATS_TOKEN` y, si no existe, `GITHUB_TOKEN` (solo ve lo público). Para `aggregate`, crear un fine-grained PAT (Settings, Developer settings) con propietario `gefydev`, acceso a todos los repositorios y permisos de solo lectura: Metadata y Pull requests. Se carga como secreto del repo `PROFILE_STATS_TOKEN`; vence como máximo al año.

## Publicación

La Action `profile-widgets.yml` corre cada 6 h, a mano (`workflow_dispatch`) y en cada push a `main`. Corre los tests, genera `dist/` y lo publica como un único commit en la rama `widgets-output` (se reescribe cada vez: el historial de `main` no crece). Referencia desde el README:

```
https://raw.githubusercontent.com/gefydev/gefydev/widgets-output/prs.svg
```

El cron solo se activa cuando el workflow está en la rama por defecto.

## Enchufar un diseño nuevo

Cada widget es una función `render(datos, theme) -> string SVG`. Para cambiar el aspecto: `svg/theme.js` (colores y fuentes), y la plantilla del widget en `svg/*.js`; `kit.js` aporta `esc`, `truncate`, `textWidth` y `frame`. Los cálculos no se tocan. Los tests de `svg.test.js` verifican que el XML sea válido con datos vacíos, enormes y hostiles.
