# Voltio — convenciones de trabajo

Documento normativo. Son las mismas reglas que rigen Marea
(`restaurant-page/docs/CONVENCIONES.md`), resumidas y ajustadas a este
repositorio. Si este documento y aquel se contradicen en algo que aquí no se
menciona, manda el de Marea.

## 0. Idioma

**En inglés** todo lo que entra al historial de git o lee un revisor: código,
nombres, comentarios, commits, pull requests, ramas, `README.md`, `AGENTS.md`
y `docs/DEPLOY.md`.

**En español** los documentos de trabajo (`docs/DATABASE.md`, este archivo,
las notas del vault) y **la interfaz**: el sistema lo usa un taller mexicano
y sus clientes. Los textos que ve una persona viven junto a su componente o,
si son etiquetas de un enum, en `lib/labels.ts` y `lib/orders/status.ts`.

## 1. Autoría

El autor y el committer de todo commit son Filiberto Sañudo. Sin trailers de
coautoría, sin frases del tipo "generated with" y sin mencionar herramientas,
en commits, pull requests, comentarios, documentación o notas del vault.

## 2. Ramas

Prefijo `feature/`. Una rama por módulo o por fase. Nunca se commitea directo
a `main`, nunca `--amend` ni force-push sobre algo ya subido.

## 3. Commits

```
<tipo>(<ámbito>): <descripción>
```

Máximo 50 caracteres, imperativo presente, en minúscula, en inglés, sin punto
final. Tipos: `feat fix refactor perf docs test build ci style chore`.

Ámbitos de este repositorio: `orders`, `quotes`, `payments`, `track`,
`notifications`, `customers`, `photos`, `team`, `settings`, `auth`, `admin`,
`landing`, `db`, `deploy`, `security`.

```
feat(quotes): supersede sent quote on withdraw
fix(track): keep form values after an error
test(payments): cover concurrent overpayment
```

Un hook versionado valida el formato. Se activa una vez por clon:

```bash
git config core.hooksPath .githooks
```

El job `commits` de CI corre el mismo script (`scripts/validate-commit-msg.sh`).

## 4. Granularidad

El criterio es la reversibilidad: `git revert <sha>` deja el sistema coherente.

- Nunca refactor mezclado con comportamiento.
- Un cambio de esquema va solo, con su migración.
- Orden para una pantalla nueva: esquema, función de dominio con su prueba de
  integración, acción del servidor, componentes, página.

## 5. Pull requests

Un pull request por fase, con techo de unas 400 líneas. La descripción
responde qué cambió, por qué y por dónde empezar a leer
(`.github/pull_request_template.md`). No se fusiona solo: lo revisa Filiberto.

## 6. Comentarios en el código

Explican el porqué, nunca el qué. Tres líneas por defecto, ocho como máximo
cuando documentan una decisión de arquitectura. En inglés. Sin `TODO` sin
fecha ni dueño.

## 7. Sin emojis

Ni en commits, ni en el código, ni en la interfaz, ni en la documentación del
repositorio. Los iconos son SVG (`components/ui/icons.tsx`).

## 8. Pruebas

- Una regla de negocio nueva vive en una función de `lib/**` que recibe un
  `Actor` explícito, y se prueba ahí, contra Postgres real
  (`*.integration.test.ts`).
- Lo que puede ocurrir a la vez se prueba ocurriendo a la vez
  (`Promise.allSettled` sobre transacciones reales), no razonando.
- Una acción del servidor nueva queda cubierta sola por
  `lib/auth/guard-coverage.test.ts`. Si es pública, se agrega a su lista a
  propósito.

## 9. Documentación en Obsidian

Igual que Marea, con tres escrituras al cerrar un módulo:

```bash
graphify update .
node scripts/graphify-to-obsidian.mjs --out "<vault>/04-Proyectos-Verticales/Voltio-Codigo"
```

| Nota | Qué es | Quién la escribe |
|---|---|---|
| `04-Proyectos-Verticales/Grupo-5-Talleres-Tecnicos.md` | Nota de producto: alcance y checklist | A mano |
| `04-Proyectos-Verticales/Voltio-Codigo/` | Mapa del código y una nota por módulo. Se sobrescribe en cada corrida | Generada |
| `04-Proyectos-Verticales/Voltio-Bitacora/` | Una nota funcional por módulo entregado. Nunca se sobrescribe | A mano |

Las notas de Voltio llevan el nombre del proyecto (`00-Mapa-del-Codigo-Voltio`,
`00-Indice-Voltio`) porque los enlaces de Obsidian se resuelven por nombre y
las de Marea ya ocupan los nombres sin sufijo.
