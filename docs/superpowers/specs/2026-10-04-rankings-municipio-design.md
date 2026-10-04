# Rankings por municipio (ranking nacional de un municipio de Sonora)

Fecha: 2026-10-04. Estado: diseño aprobado en conversación; pendiente de revisión escrita.

## Objetivo

Poder contestar en una pantalla: "¿cuál ha sido la peor (o mejor) posición de Cajeme a nivel
nacional, y en qué mes o año?". Es lo que la pestaña Rankings ya hace para una entidad entre las
32, llevado a un municipio de Sonora frente a todos los municipios del país.

Lo usa el analista de la Fiscalía cuando le preguntan por un municipio concreto.

**Éxito:** con entidad Sonora se elige un municipio y la vista muestra su evolución de lugar
nacional y dos tarjetas del tipo "Peor posición · #9 de 2,476 · 2019: 12,345 delitos".

## Decisiones del usuario

- El selector de municipio aparece **solo con entidad Sonora**. Con cualquier otra entidad, Rankings
  queda como hoy.
- La comparación es **solo nacional** (contra todos los municipios del país). No hay ranking dentro
  del estado.
- **Víctimas Municipios** pasa a ser un conjunto seleccionable en Rankings, para comparar víctimas
  por municipio de 2026 en adelante.
- La ausencia de fila vale cero solo en meses ya publicados (regla vigente desde 2026-10-04).

## Alcance

Dentro:

- Selector "Municipio" en Rankings (solo Sonora), con "Todo el estado" como primera opción.
- Conjunto "Víctimas Municipios" en el selector de conjunto de Rankings.
- Lugar nacional del municipio por periodo (Anual, Mensual, Acumulado), en cifras y en tasa.
- Tarjetas Mejor/Peor posición con "lugar de total", periodo y cifra.
- Nota de empate cuando muchos municipios comparten el lugar.

Fuera:

- Varios municipios en la misma gráfica.
- Municipios de otras entidades.
- Ranking dentro del estado (1 a 72).
- Vista compartible por URL (pospuesta aparte).

## Comportamiento

### Selección

- Selector de conjunto: Delitos, Víctimas, Víctimas Municipios.
- Selector de entidad: sin cambios.
- Selector de municipio, a la derecha del de entidad, con el mismo estilo (`.title-select`):
  - Visible solo si la entidad es Sonora.
  - Opciones: "Todo el estado" y los municipios de Sonora del conjunto aplicado, en orden alfabético
    español, sin "No especificado" ni "Otros Municipios".
  - Deshabilitado con el conjunto Víctimas (no tiene municipios), con la explicación a la vista:
    "Víctimas no tiene datos por municipio".
- Entidad y municipio se aplican al instante, igual que la métrica; no pasan por "Aplicar filtros".
- Cambiar la entidad a otra distinta de Sonora vuelve el municipio a "Todo el estado".
- Cambiar a un conjunto sin municipios vuelve el municipio a "Todo el estado".

### Título y estado aplicado

- Con municipio: "Evolución del ranking nacional de Cajeme, Sonora".
- El renglón "La gráfica muestra: …" añade el nivel: "Municipios del país" o "Entidades".

### Tarjetas

- "Mejor posición" y "Peor posición", como hoy, con el total del periodo:
  `#9 de 2,476` y debajo `2019: 12,345 delitos` (o víctimas, o "por 100 mil hab.").
- El total es el número de municipios clasificados en ese periodo; cambia entre años.
- Nota de escala: "Escala 1–N: 1 = municipio con más delitos en el periodo".

### Nota de empate

- Si en el último periodo el municipio comparte lugar con 10 o más municipios, bajo las tarjetas:
  "312 municipios comparten este lugar (todos con 0 víctimas)".
- Evita leer como mejora un cambio que solo es un empate en cero.

### Gráfica

- Una línea: la del municipio elegido, con su rótulo final (`CAJEME #12`).
- Eje Y invertido, de 1 al máximo lugar que alcanza la serie redondeado hacia arriba a una cifra
  cómoda (10, 25, 50, 100, 250, 500, 1,000, 2,500). En una escala fija de 1 a 2,500 la línea de un
  municipio grande sería una raya plana.
- Sin las divisorias de 10.5 y 20.5 (son de la escala de 32 entidades).
- Rótulos "MÁS INCIDENCIA →" / "← MENOS INCIDENCIA": sin cambios.
- Tooltip: periodo, lugar "de N", cifra y los tres primeros lugares nacionales ("Top 3 nacional")
  con municipio y entidad.

### Conjunto con un solo año (Víctimas Municipios hoy)

- Al elegirlo, el periodo pasa a "Mensual" y se avisa: "Víctimas Municipios solo tiene 2026: se
  muestra por mes".
- "Anual" y "Acumulado" siguen disponibles, marcados "(un solo año)". Con un solo punto la gráfica
  muestra el punto y su rótulo, sin línea.
- Con "Todo el estado", este conjunto clasifica a Sonora entre las 32 entidades con sus datos de
  2026. Se permite por consistencia.

### Exportación

- CSV y portapapeles: columnas `Periodo, Municipio, Lugar, De, <valor>`.
- El bloque de filtros del CSV añade "Municipio" y "Comparación: municipios del país".

## Backend

`GET /api/ranking_historico` ya acepta `nivel=municipio` y `municipios_sonora=<nombres>`: clasifica
a todos los municipios del país y devuelve los de Sonora pedidos más el top 3 de cada periodo.

Cambios:

1. **Total y empate por periodo.** Cada fila gana `n` (municipios clasificados en el periodo) y
   `empatados` (cuántos comparten ese lugar, contando al propio). La respuesta sigue siendo una
   lista plana `[{period, name, rank, total, n, empatados}]`.
2. **Qué se clasifica.** Quedan fuera las claves de municipio terminadas en 999 ("No especificado",
   "Otros Municipios"): no son municipios.
3. **Ausencia = cero.** Con `nivel=municipio`, los municipios del catálogo del conjunto
   (`CACHE_CATALOGO`) que no vinieron en la consulta entran con total 0, solo en periodos publicados
   (`CACHE_MES_FINAL`): años publicados en anual y acumulado, meses hasta el último publicado en
   mensual. Sin esto, en Víctimas Municipios "de N" contaría solo a los municipios con filas.
4. **Tasa.** Un municipio sin población (no hay dato CONAPO) queda fuera del ranking en tasa, en
   lugar de entrar con tasa 0.
5. **Municipios de Sonora para el selector.** Se obtienen de `/api/filtros?dataset=…&entidad=Sonora`
   (ya existe y ya viene ordenado).

`nivel=entidad` no cambia de forma: solo se añaden `n` y `empatados`, que el frontend puede ignorar.

Costo medido hoy (sin los cambios): municipios anual 0.9 s; anual en tasa 1.5 s; mensual 2.7 s;
Víctimas Municipios mensual 0.4 s. El filtro `municipios_sonora` reduce la respuesta mensual de más
de diez mil filas a unas 150 más el top 3.

## Frontend

Todo en `frontend/src/components/HistoryRankings.jsx`, que ya concentra Rankings:

- Estado nuevo `selectedMunicipio` ('' = todo el estado) y opción `victimas_mun` en el conjunto.
- La consulta envía `nivel=municipio&municipios_sonora=<municipio>` cuando hay municipio.
- La serie que se pinta es la de `"<municipio>, Sonora"`; el resto de filas alimenta el top 3.
- Dominio del eje y divisorias según el nivel.
- Tarjetas con `n`; nota de empate con `empatados`.
- Lista de municipios desde `/api/filtros`.

El archivo ya mide unas 800 líneas. La lógica nueva de escala y de tarjetas va en funciones puras en
`frontend/src/utils/rankings.js` (`ejeRanking(maxLugar)`, `resumenPosiciones(serie)`,
`notaEmpate(punto)`), para poder probarlas y no engordar más el componente.

## Errores y casos límite

- Fallo de red: el estado de error con "Reintentar" que ya tiene Rankings.
- Municipio sin datos en ningún periodo con los filtros elegidos: "Sin datos para <municipio> con
  estos filtros".
- Periodo sin publicar: no se rellena con ceros; el periodo no aparece.
- Municipio elegido que no existe en el conjunto nuevo al cambiar de conjunto: vuelve a "Todo el
  estado" con un aviso.

## Pruebas

Backend (`backend/tests/test_ranking_municipio.py`, con los Parquet semilla):

- El lugar de un municipio conocido coincide con contarlo a partir de `/api/incidencia_por_municipio`
  sin entidad, para el mismo año.
- `n` es el número de municipios reales del país en ese año, y es el mismo para todas las filas de
  un periodo.
- "No especificado" y "Otros Municipios" no aparecen ni cuentan en `n`.
- Víctimas Municipios con un delito poco frecuente: `n` no baja respecto a la consulta sin filtro de
  delito (relleno con ceros) y `empatados` es mayor que 1 para un municipio en cero.
- Mensual no devuelve periodos posteriores al último mes publicado.
- `nivel=entidad` conserva `rank` y `total` de antes.

Frontend (comprobación en navegador, como el resto del proyecto):

- El selector de municipio solo aparece con Sonora y se deshabilita con Víctimas.
- Con Cajeme: título, tarjetas con "de N", eje ajustado y sin divisorias.
- Víctimas Municipios pasa a Mensual con su aviso.
- Sin errores de consola ni desbordes a 1280, 900 y 375 px.

## Riesgos

- **Lectura del lugar en municipios chicos.** El lugar nacional de un municipio pequeño salta por los
  empates en cero. Lo mitiga la nota de empate; no lo elimina.
- **Tasa.** En tasa, los primeros lugares nacionales son municipios de población mínima. La vista
  conserva la nota de escala y el top 3 lo deja a la vista.
- **Tiempo de la consulta mensual nacional** (2.7 s hoy). Si el relleno con ceros la encarece, se
  mide antes de entregar y se ajusta.
