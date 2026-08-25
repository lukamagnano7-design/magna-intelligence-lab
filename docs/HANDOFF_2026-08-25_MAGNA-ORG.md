# HANDOFF · 25/08/2026 · Sesión MAGNA / EMPRESA IA

> **Estado: STANDBY.** `MAGNA-AUTOS-001` congelado en un punto exacto, para retomar sin
> reconstruir contexto.

---

## 🔴 EL PUNTO EXACTO DONDE FRENAMOS

**`MAGNA-AUTOS-001` · BLOQUE 1 — LA COMPRA DE UNA UNIDAD · presentado, esperando respuestas.**

Las 10 preguntas están completas en
[`MAGNA-AUTOS-001-DISCOVERY.md`](./MAGNA-AUTOS-001-DISCOVERY.md) → sección *🔵 BLOQUE 1*.

```
B1  🔵 ABIERTO — las 10 preguntas mostradas a Luka. Sin responder.
B2–B13  ⚪ sin abrir
Implementación  ⛔ no corresponde
```

**Lo único que falta para seguir: que Luka responda el B1** (audio o texto largo, como le salga).

### Qué hay que hacer con esas respuestas — y qué NO

Cuando lleguen, el trabajo es **entender el negocio, no diseñar la solución**. Siete cosas:

1. separar **hechos** de **reglas de negocio**
2. detectar **decisiones humanas**
3. detectar **tareas repetitivas**
4. detectar **información que ya existe** en Magna OS
5. detectar **información que hoy falta**
6. detectar **errores/problemas frecuentes**
7. detectar **oportunidades futuras** de automatización/IA

> ⛔ **NO diseñar la solución todavía.** ⛔ **NO clasificar D/A/I/AI/S/H ni L0–L3 todavía** —
> eso viene después del Discovery, no durante.

### La pregunta del B1 que más consecuencias tiene

**1.6 — qué significa exactamente `fecha_ingreso`.** El campo existe y está cargado, pero no
se sabe si es *cuándo se cerró el trato*, *cuándo llegó el auto* o *cuándo quedó listo para
vender*. **De cuál sea depende todo el cálculo de rotación**, y no es inferible del código.

### La regla del cuestionario — no se pierde

Cada pregunta lleva un bloque **`YA SÉ`** con lo que la auditoría ya estableció, para no
preguntar lo que el código responde. Es la disciplina que en Freddy costó **KE#70** y
**KE#73**. **Mantenerla en los bloques B2–B13.**

---

## ✅ DECISIONES CERRADAS — no se re-discuten

| # | Decisión |
|---|---|
| 1 | **`data/*.json` = histórico congelado.** No es segunda fuente activa. Probado por tracing: cero escritores, la app viva es 100% SQLite, `salud.js` ya lo vigila, KE#55 resuelto desde el 05/08 |
| 2 | **Falso gate `build.ps1` → `validate_data.js`** (valida los JSON del 17/07 y habilita un build que lee la DB del 24/08): registrado como deuda **MEDIA-BAJA**. **No se corrige ahora** |
| 3 | **Department Contract V1 APROBADO** — 12 obligatorias + 3 recomendadas + 3 pre-diseñadas |
| 4 | **`kpis` es OBLIGATORIO** (C12). Interfaz: fórmula · fuente · cobertura · dirección |
| 5 | **`approvals` / `audit` / `runs`: pre-diseñados, sin cablear.** *No construir infraestructura sin un problema que la justifique* |
| 6 | **`dias_en_stock` sin umbral.** No se fija 30/60/90. Se deriva del negocio: días · capital · margen esperado · consultas · vistas/conversión · precio · tipo de vehículo · propio vs consignación · costos de tenencia |
| 7 | **PROPIO y CONSIGNACIÓN son dos riesgos distintos.** Ambos envejecen comercialmente; **solo PROPIO inmoviliza capital de Luka/padre**. Dos alertas, no una con filtro |
| 8 | **KPI principal de Autos: sin fijar.** *Ganancia realizada* y *rotación* miden cosas distintas |
| 9 | **Paperclip: investigar en sandbox, no adoptar.** Condición de entrada: ≥2 departamentos |
| 10 | **No asumir que cada tarea necesita un agente.** Freddy llegó a ser el más maduro **sin un solo agente ejecutable** |

---

## 🚫 LO QUE NO SE TRABAJA EN ESTA SESIÓN

**El WhatsApp Bot de Freddy NO va acá.**

Va a la **sesión operativa de Freddy OS**, que tiene el contexto profundo: cierres, reglas,
proveedores, intake, OCR, errores conocidos y candados. Esta sesión no lo tiene y trabajarlo
desde acá sería reconstruir mal un contexto que ya existe bien en otro lado.

**Esta sesión queda reservada para:**
- diseño de Magna como organización construida con IA
- Magna Department Contract
- arquitectura de departamentos
- Autos Intelligence
- Conductor / organización
- evaluación de Paperclip y referencias
- evolución general de Magna OS

---

## 📍 DÓNDE ESTÁ TODO

| Documento | Qué contiene |
|---|---|
| [`MAGNA-AUTOS-001-DISCOVERY.md`](./MAGNA-AUTOS-001-DISCOVERY.md) | **← acá se retoma.** Mapa de 13 bloques · B1 completo · principios de dominio · lo que la auditoría ya estableció |
| [`MAGNA-ORG-002-DEPARTMENT-CONTRACT.md`](./MAGNA-ORG-002-DEPARTMENT-CONTRACT.md) | Contract V1 aprobado · Freddy vs Contract · Autos vs Contract · tracing JSON/SQLite (§T) · riesgos R1–R4 · hipótesis futuras (§F) |
| [`MAGNA-ORG-001-FREDDY-PATTERN.md`](./MAGNA-ORG-001-FREDDY-PATTERN.md) | Las 14 capas de Freddy · el patrón deseo→comando · qué generaliza y qué no |
| [`REFERENCE-ORG-001.md`](./REFERENCE-ORG-001.md) | Bennett · Metallurgia · Paperclip · Hermes · Attio, con fuentes primarias |
| [`LAB-DEEP-UNDERSTANDING-001.md`](./LAB-DEEP-UNDERSTANDING-001.md) | Cómo el Lab llegó a comprender fuentes audiovisuales completas |

**Repo:** https://github.com/lukamagnano7-design/magna-intelligence-lab · rama `main`

---

## 🧾 ESTADO TÉCNICO AL CERRAR

```
Lab            tests 43/43 en verde (16 matcher · 17 vision · 10 cobertura)
Freddy OS      NO MODIFICADO en esta sesión (los 13 archivos con cambios sin
               commitear son de Luka, del 20-24/08, anteriores)
Magna OS Fam.  NO MODIFICADO (0 archivos)
Costo          USD 0,00 — ninguna API paga en toda la sesión
```

---

## 🔎 DEUDAS REGISTRADAS — no tocar sin decisión

| | Deuda | Severidad |
|---|---|---|
| **D1** | Falso gate `build.ps1` → `validate_data.js` + `COMO_USAR.md` que dice que `data/` se edita a mano | MEDIA-BAJA |
| **D2** | Roles `.md` obsoletos en `freddy-agent-os/agents/` que hablan del Maestro de Excel | MEDIA |
| **D3** | 12 tablas diseñadas y vacías en `magna.db` — un lector nuevo no distingue "no se usa" de "está roto" | MEDIA |
| **D4** | `agents/` se llama así y no hay agentes ejecutables — sobreestima la autonomía del sistema | MEDIA |
| **D5** | El Lab: falta un **arnés de frescura de señal**. Hoy nada distingue OCR de hoy de OCR de hace dos días (casi reporté datos del 24/08 como hallazgo nuevo) | MEDIA |
| **D6** | `docs/VISION.md` del Lab todavía documenta el tope de 24 frames como vigente | BAJA |
| **D7** | ~150 MB de video en `C:\dev\_diag_reel\` de las mediciones | BAJA |

---

## ▶️ CÓMO RETOMAR MAÑANA

1. Abrir [`MAGNA-AUTOS-001-DISCOVERY.md`](./MAGNA-AUTOS-001-DISCOVERY.md) → **BLOQUE 1**.
2. Luka responde las 10 preguntas.
3. Procesar con las 7 tareas de arriba — **sin diseñar solución**.
4. Cerrar B1 con: ciclo de compra reconstruido · datos sin dónde vivir · primeras reglas del
   corpus de `knowledge` de Autos · primeras entradas de `known_errors` · **definición
   operativa de `fecha_ingreso`**.
5. Recién ahí decidir si sigue B2 o si algo que apareció cambia el orden del mapa.

**No hace falta releer nada más para arrancar.**
