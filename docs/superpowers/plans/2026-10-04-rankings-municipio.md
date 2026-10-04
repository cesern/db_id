# Rankings por municipio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la pestaña Rankings, con entidad Sonora, elegir un municipio y ver su lugar nacional por periodo (línea + tarjetas "Mejor/Peor posición · #9 de 2,476"), también con el conjunto Víctimas Municipios.

**Architecture:** El backend ya clasifica municipios a nivel nacional en `GET /api/ranking_historico?nivel=municipio`; se le añaden el total clasificado y el empate por periodo, se excluyen los "no municipios" y se rellenan con cero los municipios sin filas en periodos publicados. El frontend reutiliza `HistoryRankings.jsx` con un selector de municipio y saca la lógica nueva (eje, tarjetas, nota de empate) a funciones puras en `utils/rankings.js`.

**Tech Stack:** FastAPI + DuckDB + pandas (backend, pytest); React 19 + Recharts 3 (frontend); pruebas de funciones puras con `node --test` (incluido en Node, sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-10-04-rankings-municipio-design.md`

## Global Constraints

- El selector de municipio aparece **solo con entidad Sonora**; con Víctimas (sin municipios) va deshabilitado con el texto "Víctimas no tiene datos por municipio".
- La comparación es **solo nacional**: contra todos los municipios del país. No hay ranking dentro del estado.
- La ausencia de fila vale cero **solo en periodos ya publicados** (`CACHE_MES_FINAL`); nunca en meses futuros.
- "No especificado" y "Otros Municipios" no son municipios: no se clasifican ni cuentan en el total.
- Nota de empate cuando el municipio comparte lugar con **10 o más** municipios (contándose a sí mismo).
- Escalones del eje Y: `10, 25, 50, 100, 250, 500, 1000, 2500, 5000`.
- Interfaz en español (es-MX), tuteo, números con `toLocaleString('es-MX')`. Sin dependencias nuevas.
- Commits directo en `main`, sin ramas. Mensajes en español. No hacer push.
- Tras tocar `backend/app/`, correr `python -m pytest` desde `backend/` (hoy pasan 97).
- `nivel=entidad` debe conservar `rank` y `total` actuales.

## Review Focus

1. **Municipio con acento en el parámetro** (`municipios_sonora=Álamos`): debe encontrar la serie; antes del arreglo de nombres había dos grafías. → prueba en Task 1.
2. **Municipio con cero en todos los periodos y filtros** (p. ej. un municipio chico con Feminicidio): la vista debe decir "Sin datos para … con estos filtros" o mostrar ceros con nota de empate, nunca una gráfica vacía sin explicación. → prueba de `resumenPosiciones`/`notaEmpate` en Task 2 y comprobación en Task 3.
3. **Empate en el top 3**: si cinco municipios empatan en el lugar 1, el backend devuelve más de tres filas de top; el tooltip debe mostrar solo tres. → comprobación en Task 3.
4. **Cambio de conjunto con un municipio elegido** (de Delitos a Víctimas): el municipio vuelve a "Todo el estado" con aviso y no queda una consulta municipal contra un conjunto sin municipios. → comprobación en Task 4.
5. **Periodo sin publicar** (mensual, meses posteriores al último publicado; acumulado con corte futuro): no aparecen periodos con todos en cero. → prueba en Task 1.

---

### Task 1: Backend — ranking municipal con total, empate, exclusiones y relleno

**Files:**
- Modify: `backend/app/main.py` (función `obtener_ranking_historico` y ayudantes junto a `_completar_meses`)
- Test: `backend/tests/test_ranking_municipio.py` (nuevo)

**Interfaces:**
- Consumes: `CACHE_CATALOGO[dataset]["municipios"]` (DataFrame `Año, Entidad, Municipio`), `CACHE_MES_FINAL[dataset]` (`{año: mes 1–12}`), `_meses_pedidos(meses)`, `MES_NUM`, ya existentes en `main.py`.
- Produces: `GET /api/ranking_historico` devuelve lista plana `[{period, name, rank, total, n, empatados}]`.
  - `n` (int): filas clasificadas en ese periodo (municipios o entidades).
  - `empatados` (int): cuántas filas comparten ese `rank` en ese periodo, contando a la propia.
  - `name` municipal: `"<Municipio>, <Entidad>"` (sin cambio).
  - Con `nivel=municipio` siguen devolviéndose solo los municipios de Sonora (los de `municipios_sonora` si viene) más las filas con `rank <= 3`.

- [ ] **Step 1: Write the failing tests**

```python
"""Ranking nacional de municipios: total clasificado, empates, exclusiones y relleno con ceros."""

RK = "/api/ranking_historico"
BASE = {"dataset": "delitos", "nivel": "municipio", "temporalidad": "anual"}


def _serie(c, nombre, **extra):
    filas = c.get(RK, params={**BASE, "municipios_sonora": nombre.split(",")[0], **extra}).json()
    return [f for f in filas if f["name"] == nombre]


def test_lugar_coincide_con_la_tabla_nacional(make_client):
    c = make_client({})
    punto = next(f for f in _serie(c, "Cajeme, Sonora") if f["period"] == "2025")
    tabla = c.get("/api/incidencia_por_municipio", params={"dataset": "delitos", "anio": 2025}).json()
    reales = [m for m in tabla if m["municipio"] not in ("No especificado", "Otros Municipios")]
    cajeme = next(m for m in reales if m["name"] == "Cajeme, Sonora")
    assert punto["total"] == cajeme["value"]
    assert punto["rank"] == 1 + sum(1 for m in reales if m["value"] > cajeme["value"])
    assert punto["n"] == len(reales)


def test_n_es_igual_en_todo_el_periodo_y_empatados_minimo_uno(make_client):
    c = make_client({})
    filas = c.get(RK, params=BASE).json()
    por_periodo = {}
    for f in filas:
        por_periodo.setdefault(f["period"], set()).add(f["n"])
        assert f["empatados"] >= 1
    assert all(len(v) == 1 for v in por_periodo.values())


def test_no_municipios_fuera_del_ranking(make_client):
    c = make_client({})
    nombres = {f["name"].split(",")[0] for f in c.get(RK, params=BASE).json()}
    assert "No especificado" not in nombres
    assert "Otros Municipios" not in nombres


def test_municipio_con_acento(make_client):
    c = make_client({})
    serie = _serie(c, "Álamos, Sonora")
    assert [f["period"] for f in serie][0] == "2015"
    assert serie[-1]["period"] == "2026"


def test_victimas_mun_rellena_con_cero_y_marca_empate(make_client):
    c = make_client({})
    vm = {"dataset": "victimas_mun", "nivel": "municipio", "temporalidad": "mensual"}
    sin_filtro = c.get(RK, params=vm).json()
    feminicidio = c.get(RK, params={**vm, "subtipoDelito": "Feminicidio"}).json()
    n_base = {f["period"]: f["n"] for f in sin_filtro}
    n_fem = {f["period"]: f["n"] for f in feminicidio}
    assert n_fem == n_base                       # mismos municipios clasificados con o sin filtro
    en_cero = [f for f in feminicidio if f["name"].endswith(", Sonora") and f["total"] == 0]
    assert en_cero and all(f["empatados"] >= 10 for f in en_cero)


def test_mensual_no_pasa_del_ultimo_mes_publicado(make_client):
    c = make_client({})
    anios = c.get("/api/incidencia_por_anio", params={"dataset": "victimas_mun"}).json()
    mes_final = next(a["mes_final"] for a in anios if a["year"] == "2026")
    filas = c.get(RK, params={"dataset": "victimas_mun", "nivel": "municipio", "temporalidad": "mensual"}).json()
    assert max(f["period"] for f in filas) == f"2026-{mes_final:02d}"


def test_entidad_conserva_rank_y_total(make_client):
    c = make_client({})
    filas = c.get(RK, params={"dataset": "delitos", "nivel": "entidad", "temporalidad": "anual"}).json()
    sonora = next(f for f in filas if f["name"] == "Sonora" and f["period"] == "2025")
    tabla = c.get("/api/incidencia_por_entidad", params={"dataset": "delitos", "anio": 2025}).json()
    ref = next(e for e in tabla if e["name"] == "Sonora")
    assert (sonora["rank"], sonora["total"]) == (ref["id"], ref["value"])
    assert sonora["n"] == 32
```

- [ ] **Step 2: Run tests to verify they fail**

Run (desde `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_ranking_municipio.py -q`
Expected: FAIL con `KeyError: 'n'` (y "No especificado" presente).

- [ ] **Step 3: Implementar en `backend/app/main.py`**

- Constante `NO_MUNICIPIO = {"No especificado", "Otros Municipios"}` junto a `MES_NUM`.
- `_completar_ranking_municipios(dataset: DatasetEnum, df: pd.DataFrame, temporalidad: str, meses: Optional[str]) -> pd.DataFrame`, junto a `_completar_meses`.
  - `df` trae `period, name, Entidad, Municipio, anio_num, total` (y `population` en tasa).
  - Rejilla = catálogo de municipios del conjunto por año × periodos publicados de ese año: en `anual`/`acumulado`, el año si `_periodo_publicado(dataset, año, meses)`; en `mensual`, los meses `1..CACHE_MES_FINAL[dataset][año]` con `period = "AAAA-MM"`.
  - `merge` a la izquierda desde la rejilla; `total` ausente = 0; `name = Municipio + ", " + Entidad`.
  - Si no hay catálogo o la rejilla no supera a `df` en filas, devuelve `df` sin tocar.
- En `obtener_ranking_historico`, con `nivel == "municipio"`, en este orden y **antes** de calcular `rank`:
  1. Quitar filas con `Municipio` en `NO_MUNICIPIO`.
  2. En tasa: quitar filas con `population <= 0` (municipio sin dato CONAPO). Las filas que entran por relleno no tienen población: conservan `total = 0.0`.
  3. `_completar_ranking_municipios(...)`, salvo que `altoImpacto is not None and df.empty`.
  4. En `mensual`, descartar periodos posteriores al último mes publicado del conjunto (sustituye, solo para este nivel, el recorte por "último periodo con total > 0").
- Para ambos niveles, tras calcular `rank`:
  `n = groupby('period')['rank'].transform('size')` y `empatados = groupby(['period', 'rank'])['rank'].transform('size')`, ambos `int`.
- Devolver `df_res[['period', 'name', 'rank', 'total', 'n', 'empatados']]`.

- [ ] **Step 4: Run tests to verify they pass, y la suite completa**

Run: `./venv/Scripts/python.exe -m pytest -q`
Expected: 104 passed (97 + 7).

- [ ] **Step 5: Medir la consulta más pesada**

Run (con el backend en marcha): `curl -s -o /dev/null -w "%{time_total}\n" "http://127.0.0.1:8000/api/ranking_historico?dataset=delitos&nivel=municipio&temporalidad=mensual&municipios_sonora=Cajeme"`
Expected: menos de 5 s (hoy 2.7 s sin relleno). Si lo supera, aplicar el relleno solo cuando el conjunto no sea denso (`len(rejilla) > len(df)` ya lo evita en Delitos) y volver a medir.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_ranking_municipio.py
git commit -m "Backend: ranking nacional de municipios con total, empate y relleno con ceros"
```

---

### Task 2: Frontend — funciones puras de Rankings

**Files:**
- Create: `frontend/src/utils/rankings.js`
- Test: `frontend/tests/rankings.test.js` (nuevo; `node --test`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ejeRanking(maxLugar: number) -> { max: number, ticks: number[] }`
  - `resumenPosiciones(serie: Array<{period: string, rank: number, total: number, n: number}>) -> { mejor: {rank, items}, peor: {rank, items} } | null`, con `items: Array<{period, total, n}>`. "Mejor" = lugar numérico **más alto** (menos incidencia); "peor" = el más bajo. Mismo criterio que hoy en `summaryEntidad`.
  - `notaEmpate(punto: {empatados: number, total: number} | null, unidad: string) -> string | null`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejeRanking, resumenPosiciones, notaEmpate } from '../src/utils/rankings.js';

test('ejeRanking sube al siguiente escalón', () => {
  assert.deepEqual(ejeRanking(12), { max: 25, ticks: [1, 13, 25] });
  assert.deepEqual(ejeRanking(46), { max: 50, ticks: [1, 25, 50] });
  assert.deepEqual(ejeRanking(2476), { max: 2500, ticks: [1, 1250, 2500] });
  assert.deepEqual(ejeRanking(1), { max: 10, ticks: [1, 5, 10] });
  assert.equal(ejeRanking(9000).max, 9000);   // por encima del último escalón: el propio valor
});

test('resumenPosiciones: mejor = lugar más alto, peor = más bajo, con todos los periodos empatados', () => {
  const serie = [
    { period: '2019', rank: 9, total: 12345, n: 2476 },
    { period: '2020', rank: 14, total: 9000, n: 2470 },
    { period: '2021', rank: 9, total: 12000, n: 2480 },
  ];
  const r = resumenPosiciones(serie);
  assert.equal(r.peor.rank, 9);
  assert.deepEqual(r.peor.items.map(i => i.period), ['2019', '2021']);
  assert.equal(r.mejor.rank, 14);
  assert.deepEqual(r.mejor.items, [{ period: '2020', total: 9000, n: 2470 }]);
  assert.equal(resumenPosiciones([]), null);
});

test('notaEmpate solo desde 10 empatados', () => {
  assert.equal(notaEmpate({ empatados: 9, total: 0 }, 'víctimas'), null);
  assert.equal(notaEmpate({ empatados: 312, total: 0 }, 'víctimas'), '312 municipios comparten este lugar (todos con 0 víctimas)');
  assert.equal(notaEmpate({ empatados: 1200, total: 3 }, 'delitos'), '1,200 municipios comparten este lugar');
  assert.equal(notaEmpate(null, 'delitos'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (desde `frontend/`): `node --test tests/rankings.test.js`
Expected: FAIL con "Cannot find module … rankings.js".

- [ ] **Step 3: Implementar las tres funciones en `frontend/src/utils/rankings.js`**

`ticks` = `[1, Math.round(max / 2), max]`. Escalones según Global Constraints. Sin imports de React ni de otros módulos.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/rankings.test.js`
Expected: 3 pruebas, 0 fallas.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/rankings.js frontend/tests/rankings.test.js
git commit -m "Rankings: funciones puras de eje, posiciones y nota de empate"
```

---

### Task 3: Frontend — selector de municipio y vista municipal

**Files:**
- Modify: `frontend/src/components/HistoryRankings.jsx`
- Modify: `frontend/src/index.css` (solo si el segundo selector necesita espacio; reutilizar `.title-select`)

**Interfaces:**
- Consumes: respuesta de Task 1 (`n`, `empatados`); `ejeRanking`, `resumenPosiciones`, `notaEmpate` de Task 2; `GET /api/filtros?dataset=<conjunto>&entidad=Sonora` → `municipios: string[]` (ya ordenados).
- Produces (para Task 4): estado `selectedMunicipio: string` ('' = todo el estado), `municipiosSonora: string[]`, y `nivel: 'entidad' | 'municipio'` derivado así: `'municipio'` si `selectedEntidad === 'Sonora'`, `selectedMunicipio !== ''` y `applied.dataset !== 'victimas'`.

- [ ] **Step 1: Estado, lista de municipios y consulta**

- `selectedMunicipio` y `municipiosSonora`; la lista se pide a `/api/filtros` al cambiar `applied.dataset` (no se pide con `victimas`) y excluye "No especificado" y "Otros Municipios".
- La consulta de ranking envía `nivel` y, en modo municipio, `municipios_sonora=<selectedMunicipio>`. `selectedMunicipio` y `nivel` entran en las dependencias del efecto (entidad y municipio se aplican al instante).
- Nombre de la serie: `serieName = nivel === 'municipio' ? \`${selectedMunicipio}, Sonora\` : selectedEntidad`. Sustituye a `selectedEntidad` como clave en `chartData`, `summaryEntidad`, `dataForExport`, la `<Line>` y el rótulo final.
- `chartData` guarda además `<name>_n` y `<name>_emp` por periodo.
- Cambiar la entidad a otra distinta de Sonora pone `selectedMunicipio = ''`.

- [ ] **Step 2: Selector de municipio en el título**

- Segunda pastilla `.title-select` a la derecha de la de entidad, visible solo con `selectedEntidad === 'Sonora'`, `aria-label="Municipio"`.
- Opciones: `"Todo el estado"` (valor `''`) y `municipiosSonora`.
- Con `applied.dataset === 'victimas'`: `disabled` y, al lado, el texto "Víctimas no tiene datos por municipio".
- Título accesible del `<h2>`: "Evolución del ranking nacional de Cajeme, Sonora" en modo municipio.

- [ ] **Step 3: Tarjetas, nota de empate, eje y tooltip**

- Tarjetas: usar `resumenPosiciones`; en modo municipio el lugar se muestra `#9 de 2,476` (el `n` del periodo más reciente de la tarjeta).
- Nota de escala: "Escala 1–N: 1 = municipio con más delitos en el periodo" (N = `n` del último periodo; "víctimas"/"mayor tasa" según conjunto y métrica).
- Nota de empate: `notaEmpate(últimoPunto, unidad)` bajo las tarjetas, cuando no sea `null`.
- Eje Y en modo municipio: `domain={[1, eje.max]}`, `ticks={eje.ticks}` con `eje = ejeRanking(máximo rank de la serie)`; sin las dos `ReferenceLine`. En modo entidad queda como hoy (`[1, 32]`, ticks `1/10/20/32`, divisorias).
- Rótulo final: `CAJEME #12`.
- Tooltip: lugar "#12 de 2,476"; "Top 3 nacional" limitado a las tres primeras filas con `rank <= 3`, mostrando municipio y entidad.
- Renglón "La gráfica muestra: …" añade "Municipios del país" o "Entidades".
- Sin serie para el municipio con los filtros aplicados: "Sin datos para Cajeme con estos filtros" en el área de la gráfica.

- [ ] **Step 4: Exportación**

- CSV y portapapeles en modo municipio: columnas `Periodo, Municipio, Lugar, De, <valor>`.
- Los filtros que se pasan a `downloadCSV` incluyen `municipio` y `entidad: 'Sonora'`.

- [ ] **Step 5: Verificar en el navegador**

Con backend y frontend en marcha (`.claude/launch.json`: `backend`, `frontend`), pestaña Rankings a 1280×800:
- Con entidad Sonora aparece "Municipio"; con otra entidad, no.
- Con Cajeme: título, dos tarjetas con "de N", eje con tres marcas y sin divisorias, rótulo final.
- Con un municipio chico y un subtipo poco frecuente: aparece la nota de empate.
- Tooltip con tres filas en "Top 3 nacional" aunque haya empate en el primer lugar.
- Con Víctimas: el selector queda deshabilitado con su texto.
- Consola sin errores; sin desborde horizontal a 1280, 900 y 375 px.
- `npx eslint src` no añade errores (hoy 24 problemas previos) y `npx vite build` compila.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/HistoryRankings.jsx frontend/src/index.css
git commit -m "Rankings: lugar nacional de un municipio de Sonora"
```

---

### Task 4: Frontend — Víctimas Municipios en Rankings y cierre

**Files:**
- Modify: `frontend/src/components/HistoryRankings.jsx`
- Modify: `frontend/src/components/FullScreenHeader.jsx` (badge "Municipio" y nombre del conjunto para Rankings)
- Modify: `AGENTS.md` (nota de la función en §14c)

**Interfaces:**
- Consumes: `selectedMunicipio`, `municipiosSonora`, `nivel` (Task 3); `mesFinalPorAnio` (ya existe en el componente: `{ '2026': 8 }`).
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Conjunto seleccionable**

- Tercera opción del selector de conjunto: valor `victimas_mun`, texto "Víctimas Municipios".
- La unidad ("víctimas") y los filtros Sexo y Rango de edad aplican a `victimas` y `victimas_mun` (hoy varias comparaciones son `=== 'victimas'`; pasar a `!== 'delitos'`).

- [ ] **Step 2: Conjunto con un solo año**

- Cuando `mesFinalPorAnio` del conjunto aplicado tiene un solo año y el periodo aplicado es `anual`: pasar selección y aplicado a `mensual` y avisar con `toast`: "Víctimas Municipios solo tiene 2026: se muestra por mes" (id `rankings-un-anio`).
- En el selector de periodo, "Anual" y "Acumulado" llevan el sufijo " (un solo año)" mientras el conjunto tenga un solo año.
- Con un solo punto, la `<Line>` muestra el punto (`dot`) y su rótulo.

- [ ] **Step 3: Cambio de conjunto con municipio elegido**

- Al aplicar un conjunto: si es `victimas`, o si `selectedMunicipio` no está en la nueva `municipiosSonora`, poner `selectedMunicipio = ''` y avisar: "Se volvió a Todo el estado: <conjunto> no tiene datos de <municipio>" (para `victimas`: "Víctimas no tiene datos por municipio").

- [ ] **Step 4: Pantalla completa y documentación**

- `FullScreenHeader`: badge "Municipio: Cajeme" cuando Rankings está en modo municipio, y "Víctimas Municipios" como nombre del conjunto.
- `AGENTS.md`: párrafo "Rankings por municipio (2026-10-04)" con: selector solo en Sonora, comparación nacional, campos `n`/`empatados`, `NO_MUNICIPIO`, relleno con ceros en el ranking, `utils/rankings.js`, `node --test tests/rankings.test.js`, y las decisiones del usuario (solo nacional; solo Sonora).

- [ ] **Step 5: Verificar en el navegador**

- Elegir Víctimas Municipios: pasa a Mensual con su aviso; la línea tiene un punto por mes publicado.
- Con Cajeme en Víctimas Municipios y un subtipo: tarjetas con "de N" igual al total sin filtro de delito.
- De Delitos + Cajeme a Víctimas: vuelve a "Todo el estado" con aviso; no hay petición con `nivel=municipio` y `dataset=victimas` (revisar red).
- Pantalla completa: badges de municipio y conjunto.
- `node --test tests/rankings.test.js`, `npx eslint src` (sin errores nuevos), `npx vite build` y, desde `backend/`, `python -m pytest`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/HistoryRankings.jsx frontend/src/components/FullScreenHeader.jsx AGENTS.md
git commit -m "Rankings: Víctimas Municipios seleccionable y conjunto de un solo año por mes"
```
