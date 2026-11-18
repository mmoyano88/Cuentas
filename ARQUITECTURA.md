# ARQUITECTURA DE «CUENTAS»

Documento de referencia para entender cómo está montada la app antes de tocar nada. Escrito en lenguaje sencillo. Si algo de aquí choca con lo que el código dice de verdad, **manda el código**, y hay que avisar a Miguel para actualizar este archivo.

> **Aviso de fiabilidad.** Este documento se ha elaborado a partir de la Guía de decisiones, el Diario del proyecto, el esquema de la base de datos (`BD_Contabilidad_App.xlsx`, estado 25/09/2026 más la hoja `pendiente` de octubre) y el `Código.gs`. Los **nombres de pestañas, columnas, acciones del backend y claves de configuración** son fiables. Los **nombres de funciones de los módulos** (`fv...`, `pre...`, `imp...`, etc.) vienen de la documentación: antes de apoyarse en uno, **buscarlo en el código** y confirmar que existe tal cual.

---

## 1. Las tres piezas

| Pieza | Dónde vive | Qué hace |
| --- | --- | --- |
| **Pantalla (la app)** | GitHub Pages, repositorio `mmoyano88/Cuentas`. Es una PWA instalable | Todo lo que se ve y se toca. No contiene ningún dato |
| **Backend** | Google Apps Script (`Código.gs`), privado | Único que habla con la hoja de cálculo. Exige clave + código de sesión |
| **Base de datos** | Google Sheets | Una pestaña por tipo de dato |

Regla de oro: **la pantalla nunca toca Google Sheets directamente.** Todo pasa por el backend.

---

## 2. Qué hace cada archivo del proyecto

### Núcleo y comunes

- `index.html` — esqueleto de la app. Carga, en este orden, todos los CSS y JS. **El orden importa.** `tema.css` debe ser siempre el **último** CSS. `iconos-contacto.js` debe cargarse **antes** que `app.js`.
- `app.js` — **el núcleo**. Sesión (clave + PIN), sincronización, cola de guardado, pendientes, avisos, diálogos, selectores comunes (contacto, icono), carrusel, repintado. Casi todos los módulos dependen de él.
- `app.css` — estilos base y comunes.
- `tema.css` — todo el aspecto del rediseño (banda negra, menú, botones, tarjetas...). Va el último para ganar siempre a los demás CSS.
- `manifest.json` — datos de la PWA (nombre, colores, iconos). **No fija la orientación** (gira libremente).
- `sw.js` — *service worker*: guarda la app en el dispositivo para abrirla rápido y sin conexión. Contiene `VERSION` (ej. `cuentas-v86`) y la lista `ARCHIVOS` de todo lo que se cachea.
- `iconos-contacto.js` — catálogo de 147 iconos para contactos.
- `iconos-plantilla.js` — catálogo de iconos y colores de categoría para Plantillas.

### Módulos (cada uno con su `.js` y su `.css`)

- `mod-navegacion` — menú lateral (PC) y barra inferior + panel «Más» (Android). Contiene `MENU`, `MOVIL_DIRECTOS`, `MOVIL_MAS`.
- `mod-dashboard` — pantalla **Inicio** (tarjetas, gráficos, listas).
- `mod-configuracion` — Configuración (pestañas, copias de seguridad, archivar).
- `mod-clientes` — Clientes y Proveedores, regla del NIF duplicado, ficha, accesos rápidos.
- `mod-presupuestos` — Presupuestos **y la Calculadora**.
- `mod-facturas-venta` — Facturas de venta.
- `mod-facturas-compra` — Facturas de compra.
- `mod-contabilidad` — Apuntes (libro de dinero movido) y conversor de apunte a factura.
- `mod-impuestos` — Impuestos (IVA e IRPF por trimestre, pagos, plazos).
- `mod-informes` — Informes, Excel, 347, datos en el dispositivo.
- `mod-plantillas` — Plantillas de presupuesto, factura y apunte.
- `mod-misdatos` — pantalla «Mis datos» (copiar/compartir datos de facturación y cobro).
- `mod-pendiente` — Pendiente (trabajos por facturar y cobros).

### Solo `.js`

- `mod-pdf-motor.js` — dibuja el PDF de presupuesto/factura con jsPDF.
- `mod-pdf-documentos.js` — genera, descarga, guarda en Drive y gestiona los PDF pendientes sin conexión.
- `mod-pdf-informes.js` — PDF de Informes (trimestral y anual).
- `mod-revision.js` — «Revisión de datos» (solo avisa, nunca escribe).

### Librerías y recursos en el propio repositorio (no cambiar a un CDN)

- `tabler-icons.min.css`, `tabler-icons.woff2` — iconos.
- `chart.umd.js` — gráficos (Chart.js 4.4.1).
- `jspdf.umd.min.js` — generador de PDF (se carga solo la primera vez que se pide un PDF).
- `pdf-archivo-black.ttf`, `pdf-inter-400.ttf`, `-700`, `-800`, `-900`, `pdf-inter-cursiva-400.ttf`, `-700` — fuentes de los PDF.
- `bricolage-800.woff2` — fuente de títulos y cifras grandes.
- `cabecera-banda.webp` — imagen de la banda negra.
- `20260906_145914_0000.png` — **imagen de cabecera de los PDF. No borrar ni renombrar.**
- `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` — iconos de la app.

### Archivos que están en el repositorio pero la app NO carga

- Copia de `Código.gs` **sin claves**, y los `README`.

---

## 3. Cómo viajan los datos

### 3.1 Al abrir la app

1. Carga **desde el propio dispositivo** (`localStorage`) la última copia conocida y pinta todo al instante.
2. Después llama a la sincronización con Google Sheets.
3. Si falla, se queda con lo que tenía y el indicador pasa a rojo. No se pierde nada.

### 3.2 Entrar (una vez por dispositivo)

- La app pide **clave** (la de Bitwarden) y **PIN**.
- Los manda al backend con la acción `login`. Si son correctos, devuelve un **código de sesión** (huella SHA-256 de clave+PIN).
- El dispositivo guarda **la clave y el código de sesión. Nunca el PIN.**
- Si en `Código.gs` se cambia la clave o el PIN, todas las sesiones dejan de valer y se vuelve a pedir entrar.

### 3.3 Leer (sincronizar)

- Una sola petición, acción `sync`. La app envía las **marcas** que tiene (una por pestaña). El backend responde con las marcas actuales y **solo los datos de las pestañas que han cambiado**.
- Las marcas viven en la pestaña `sync_marcas` y el backend las actualiza en cada `save`, `delete` y `save_config`.
- Si alguien edita la hoja **a mano**, un aviso automático de Google marca todas las pestañas como cambiadas y la app lo descarga todo una vez.
- La app solo guarda marcas de las pestañas que **conoce** (clave local `cuentas_marcas_v2`).

### 3.4 Escribir (guardar y borrar)

Patrón obligatorio en toda la app:

1. El cambio se **apunta como pendiente en el dispositivo ANTES de enviarlo**.
2. Se actualiza la pantalla y la ventana **se cierra al instante**.
3. El envío sigue en segundo plano.
4. **Si falla, NO se deshace:** el registro queda en rojo y se reenvía solo en la siguiente sincronización o con «Reintentar guardado».
5. Hay una cola por id: dos guardados del mismo registro no se cruzan.
6. Tiempo máximo por petición: 25 s, con un único reintento solo para lo que es seguro repetir.

Excepción: un **contacto nuevo** espera la respuesta, porque su número lo genera Google.

### 3.5 Registros que van acompañados de otro

Factura + su apunte, presupuesto + su detalle, impuesto + su apunte, pendiente + su apunte: se envían **a la vez**.

### 3.6 PDF y Drive

- El PDF se genera **dentro de la app** y se guarda en Drive con `guardar_pdf`: `carpeta madre › año › Ventas | Presupuestos | Informes`.
- Si no hay conexión, queda pendiente en el dispositivo (IndexedDB, base `cuentas_pdf_v1`) y se reenvía solo.
- Un Excel (`.xlsx`) solo se admite en la carpeta `Informes`.

---

## 4. Contrato con el backend (no cambiar)

Todo es **POST** a la misma URL, con cabecera `Content-Type: text/plain;charset=utf-8` (deliberado: evita una comprobación previa del navegador que Apps Script no sabe responder). **Nunca usar** **`application/json`.** `doGet` no devuelve datos.

Cuerpo: `{ clave, token, action, sheet, data, marcas, pin }`

| `action` | Qué hace |
| --- | --- |
| `login` | Comprueba clave + PIN, devuelve `token` |
| `comprobar_pin` | Comprueba el PIN antes de una acción delicada |
| `ping` | Comprueba que la sesión sigue valiendo |
| `sync` | Marcas + datos de lo que ha cambiado |
| `save` | Crea o sobrescribe una fila por `id` |
| `delete` | Borra una fila por `id` |
| `save_config` | Guarda claves de configuración |
| `info_copias` | Lista las copias de seguridad de Drive |
| `copia_ahora` | Hace una copia ahora |
| `archivar` | Pasa años antiguos a un libro aparte |
| `guardar_pdf` | Guarda PDF o Excel en Drive |
| `url_pdf` | Devuelve el enlace de un PDF ya guardado |

Respuesta correcta: `{ status: 'success', ... }`. Errores con `code`: `clave`, `pin`, `bloqueado`, `sinpin`.

**El backend construye cada fila recorriendo las cabeceras reales de la pestaña.** Consecuencia crítica:

- Un campo que se envía y **no existe como columna** → se descarta **en silencio, sin error**.
- Una columna que existe y **no se envía** → se guarda **vacía, sin error**.

Por eso, antes de dar por bueno cualquier guardado, hay que cotejar los campos enviados contra las columnas de la tabla de abajo **en las dos direcciones**.

---

## 5. Pestañas y columnas que espera Google Sheets

Nombre lógico (el que usa la app) → pestaña real. **Coinciden todas menos una:** **`impuestos`** **→ pestaña** **`Impuestos`** **(con mayúscula).**

**`clientes`** (14) `id | nombre_contacto | nombre_fiscal | icono | nif | calle | numero | codigo_postal | poblacion | provincia | telefono | mail | tipo | rol | estado`

**`presupuestos`** (24) `id | id_presupuesto_origen | numero | fecha | id_cliente | cliente | nif | concepto | descripcion | subtotal | ajuste_cliente_pct | ajuste_cliente_importe | compensacion_irpf_pct | compensacion_irpf_importe | descuento_especial_tipo | descuento_especial_valor | descuento_especial_importe | base | iva_pct | iva | irpf_pct | irpf | total | estado`

**`presupuestos_detalle`** (24) — también guarda el desglose de las plantillas de presupuesto (su `id_presupuesto` empieza por `plp-`) `id | id_presupuesto | concepto_calculadora | horas_trabajo | horas_noche_festivo | horas_edicion | horas_desplazamiento | kilometros_desplazamiento | gasto_salarios | gasto_materiales | gasto_dietas | gasto_otros | margen_otros_gastos_pct | precio_hora_trabajo | incremento_noche_pct | precio_hora_edicion | precio_hora_desplazamiento | precio_km | equipos_json | servicios_extra_json | subtotal_calculadora | tipo_cliente_id | iva_id | irpf_id`

**`ventas`** (26) `id | numero | fecha | id_cliente | cliente | nif | id_presupuesto | concepto | descripcion | base | descuento_especial_tipo | descuento_especial_valor | descuento_especial_importe | subtotal | ajuste_cliente_pct | ajuste_cliente_importe | compensacion_irpf_pct | compensacion_irpf_importe | iva_pct | iva | irpf_pct | irpf | total | estado | fecha_cobro | estado_registro`

**`compras`** (16) `id | numero | fecha | id_proveedor | proveedor | nif | concepto | base | iva_pct | iva | irpf_pct | irpf | total | estado | fecha_pago | estado_registro`

**`apuntes`** (20) `id | id_factura_venta | id_factura_compra | fecha | ambito | tipo | impuesto_tipo | impuesto_trimestre | impuesto_año | concepto | base | iva_pct | iva | irpf_pct | irpf | total | id_contacto | contacto_libre | id_impuesto | impuesto_pago` *(No existe ninguna columna* *`importe`. Ojo a* *`impuesto_año`* *con tilde.)*

**`Impuestos`** (13) `id | año | trimestre | iva_estimado | irpf_estimado | iva_real | irpf_real | iva_estado | irpf_estado | iva_fecha_pago | irpf_fecha_pago | id_apunte_iva | id_apunte_irpf` *(Ojo a* *`año`* *con tilde.)*

**`plantillas_presupuesto`** (12) `id | nombre | icono | id_cliente | concepto | descripcion | detalles | subtotal | descuento_especial_tipo | descuento_especial_valor | iva_pct | irpf_pct`

**`plantillas_factura`** (12) `id | nombre | icono | id_cliente | concepto | descripcion | detalles | importe | descuento_especial_tipo | descuento_especial_valor | iva_pct | irpf_pct`

**`plantillas_apunte`** (12) `id | nombre | icono | tipo | ambito | id_contacto | contacto_libre | concepto | detalles | total | iva_pct | irpf_pct`

**`pendiente`** (11) `id | id_cliente | concepto | importe | id_factura | factura | id_presupuesto | tipo | ambito | id_apunte | contacto_libre`

**`configuracion`** (2 columnas, formato clave-valor) `clave | valor`

**`sync_marcas`** (2) — la rellena sola el backend `hoja | marca`

**Ya no existen:** `ventas_detalle` (borrada el 24/09/2026; las facturas ya no tienen líneas).

### Claves de la pestaña `configuracion`

Texto simple: `perfil_email`, `perfil_telefono`, `fiscal_nombre`, `fiscal_nif`, `fiscal_calle`, `fiscal_numero`, `fiscal_codigo_postal`, `fiscal_poblacion`, `fiscal_provincia`, `fiscal_iban` (se crea sola al guardar por primera vez), `texto_pie_presupuesto` y `texto_pie_factura` (HTML). Números: `compensacion_irpf` (20), `precio_hora_trabajo` (25), `precio_hora_edicion` (15), `precio_hora_desplazamiento` (10), `precio_km` (0,35), `incremento_noche` (50), `margen_otros_gastos` (30). Listas guardadas como **texto JSON**: `iva_tipos`, `irpf_tipos`, `tipos_cliente`, `equipos`, `servicios_extra`. Reservada sin uso: `series_config`.

---

## 6. Identificadores y formatos que NUNCA deben cambiar

### Quién genera cada `id`

| Registro | Formato | Lo genera |
| --- | --- | --- |
| Contacto (`clientes`) | número (1, 2, 3...) | **El backend** (nunca la pantalla) |
| Presupuesto | `pres-...` | La pantalla |
| Detalle de presupuesto | `pdet-...` | La pantalla |
| Plantilla de presupuesto (en `presupuestos_detalle`) | `plp-...` | La pantalla |
| Factura de venta | `fac-...` | La pantalla |
| Factura de compra | `fc-...` | La pantalla |
| Apunte | `apu-...` | La pantalla |
| Trabajo pendiente | `pen-...` | La pantalla |
| Registro de impuestos | `imp-2026-Q3` (año + trimestre, **determinista**) | La pantalla |

### Valores de texto exactos

- `estado` de facturas: `pendiente` / `pagada` (**todo en minúscula**). `estado_registro`: `activo` / `inactivo`.
- `estado` de presupuestos: `pendiente` / `aceptado` / `rechazado`.
- `estado` de contactos: `activo` / `inactivo`. `rol`: `cliente` / `proveedor` / `ambos`.
- `tipo` de cliente (códigos internos, **no renombrar**): `normal`, `profesional`, `habitual`, `ayuntamiento_pequeno`, `ayuntamiento_mediano`, `ayuntamiento_grande`. El campo `nombre` dentro de `tipos_cliente` es el identificador estable.
- Apuntes: `ambito` = `empresa` / `personal`; `tipo` = `ingreso` / `gasto`; `impuesto_tipo` = `ninguno` / `iva` / `irpf` / `iva_irpf`.
- Impuestos: `iva_estado` / `irpf_estado` = `pendiente` / `pagado` / `sin_pago`. Trimestres `Q1`–`Q4` (no `T1`).
- Pendiente: `tipo` = `factura` / `cobro`; `ambito` = `empresa` / `personal` (vacío = empresa de siempre).
- Fechas: siempre texto `AAAA-MM-DD`. Se muestran como `DD/MM/AAAA`.
- Dinero: se redondea a 2 decimales **en cada paso intermedio**, no solo al final.
- Columna `id` y las que empiezan por `id_` son **identificadores**: nunca deben tener formato de fecha.

### Cosas de Google Sheets que han dado problemas reales

- Sheets puede devolver como **número** un dato que parece texto (teléfono, nombre de solo cifras). Antes de usar `.replace()`, `.trim()`, `.split()`, `.localeCompare()`... sobre algo que viene de Sheets, convertirlo con `String(valor || '')`. Un fallo así llegó a romper una pantalla entera.
- Nunca usar el atributo `disabled` en un campo de formulario cuyo valor haya que guardar: su valor **no se envía**.

---

## 7. Funciones, constantes y nombres críticos (no renombrar, no borrar)

### En `Código.gs` (backend)

`doGet`, `doPost`, `codigoDeSesion`, `comprobarPin`, `desbloquearPin`, `conCerrojo`, `sincronizacion`, `manejarGuardar`, `manejarBorrar`, `manejarGuardarConfig`, `actualizarMarca`, `obtenerMarcasPlano`, `alCambiarHojaAMano`, `activarAutomatismos`, `copiaDeSeguridad`, `infoCopias`, `archivarAnios`, `guardarPdfEnDrive`, `buscarPdfEnDrive`, `escribirFilaConTexto`. Constantes: `SHEETS`, `HOJA_MARCAS`, `CLAVE_ACCESO`, `PIN_ACCESO`, `SPREADSHEET_ID`, `CARPETA_PDF_ID`, `ANIOS_PROTEGIDOS`. Nombres en las tres primeras constantes: **solo viven en el Apps Script real**; en cualquier copia deben quedarse como `CAMBIAME` / `PEGA_AQUI_...`.

### En el núcleo (`app.js`)

`llamarBackend`, `unIntentoBackend`, `guardarRegistro`, `borrarRegistro`, `sincronizar`, `confirmarConPin`, `pedirPin`, `mostrarDialogoOpciones`, `pintarVistaActiva`, `repintarSinSaltar`, `prepararCarrusel`, `abrirSelectorContacto`, `abrirSelectorIcono`, `htmlIconoContacto`, `conRetardo`, `puedeEscribir`, `ejecutarReconciliadores`, `estado` (objeto con todos los datos; `estado.syncReady`), `ENTIDADES` (lista de pestañas que la app conoce), `VISTA_INICIAL`. **Orden crítico en la sincronización:** `estado.syncReady = true` debe marcarse **después de descargar los datos y antes de ejecutar los reconciliadores**. Invertirlo hace que las reparaciones automáticas nunca se ejecuten. `pintarVistaActiva` envuelve cada pantalla en `try/catch` para que un fallo no deje la app sin menú. No quitarlo.

### Fórmulas fiscales y contables 🔒 (no tocar sin petición explícita de Miguel)

- Redondeo de dinero (`roundMoney`).
- Cálculo de presupuesto: `subtotal → ajuste por tipo de cliente → compensación IRPF → descuento especial → base → IVA → retención → total`. **El orden importa.**
- Calculadora (horas, noche, edición, desplazamiento, equipos, gastos con margen del 30 %, servicios extra) y su panel de rentabilidad.
- Cálculo inverso del apunte manual: `base = total / (1 + IVA% − IRPF%)`.
- Impuestos: IVA y IRPF por trimestre **sin arrastre entre trimestres**, regla de «a adelantar», plazos.
- Inicio: ingreso = base − retención; gasto = base; solo dinero cobrado o pagado.
- `compensacion_irpf` es **una sola clave** para dos usos a propósito (compensación en presupuestos y porcentaje de estimación del IRPF). No separar. Funciones citadas en la documentación para estos cálculos: `preTotalesDesdeSubtotal`, `ctTotalesDesdeTotal`, `fvCalcularFormulario`, `impCalcular`, `impAdelantar`, `impProximoPago` (comprobar que existen antes de usarlas).

### Reglas de integridad que el código garantiza

- Un presupuesto **aceptado** no se edita (se duplica). Uno **facturado** no se edita, ni cambia de estado, ni se elimina.
- Las facturas **no se borran**: se desactivan.
- Un contacto **con historial** no se elimina: se desactiva.
- Los apuntes de ámbito **personal** nunca entran en cálculos fiscales.
- Los pagos de impuestos **no** cuentan como gasto económico.
- Un apunte vinculado a una factura o a un impuesto se modifica **desde su origen**, no desde Contabilidad.
- Relaciones que no pueden romperse: presupuesto→factura (`ventas.id_presupuesto`), factura cobrada→apunte (`apuntes.id_factura_venta`), compra pagada→apunte (`apuntes.id_factura_compra`), impuesto pagado→apunte (`apuntes.id_impuesto` + `impuesto_pago`), trabajo pendiente→factura (`pendiente.id_factura`), trabajo→presupuesto (`pendiente.id_presupuesto`), cobro→apunte (`pendiente.id_apunte`).

---

## 8. Cómo se publica un cambio

### Archivos de la pantalla (GitHub)

1. Subir el archivo cambiado (mismo nombre).
2. Si el archivo es **nuevo**: añadirlo a `index.html` **y** a la lista `ARCHIVOS` de `sw.js`.
3. **Subir siempre el número** **`VERSION`** **de** **`sw.js`** (si no, los dispositivos siguen sirviendo la versión antigua guardada).
4. Esperar un par de minutos antes de probar: GitHub Pages tarda en servir lo recién subido.
5. `app.js` debe llevar la dirección del backend **real**.

### Backend (Apps Script)

1. Pegar el `Código.gs` conservando clave, PIN, ID de la hoja e ID de la carpeta de Drive **reales**.
2. Implementar → Gestionar implementaciones → lápiz → Versión: **Nueva versión**. **Nunca** crear una implementación nueva: cambiaría la dirección y la app dejaría de conectar.
3. El agente local **no puede** publicar el backend: solo Miguel, a mano.

### Orden cuando se añade una pestaña nueva

Primero la pestaña en Sheets → luego `Código.gs` (línea nueva en `SHEETS`) como nueva versión → por último los archivos de la app. Si el backend se publica sin que exista la pestaña, la sincronización falla en **todos** los dispositivos.

---

## 9. Seguridad

- El repositorio es **público**. **Nunca** debe contener la clave, el PIN, el ID de la hoja ni el ID de la carpeta de Drive.
- En cualquier copia de `Código.gs` fuera de Apps Script, esos valores son `CAMBIAME` y `PEGA_AQUI_...`.
- Con esos marcadores puestos, el backend se niega a abrirse (`sinpin`).
- El PIN lo pide la app en las acciones delicadas, pero para guardar y borrar el backend exige solo la sesión. Por eso los dispositivos deben tener bloqueo de pantalla y, si se pierde uno, hay que cambiar clave y PIN.
