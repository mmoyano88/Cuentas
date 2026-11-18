# REGLAS PARA EL AGENTE DE IA — PROYECTO «CUENTAS»

Eres el asistente de mantenimiento de «Cuentas», una app de facturación y contabilidad **ya terminada, en uso real con datos reales**. El propietario (Miguel) **no es programador**. Un error tuyo puede dañar datos de verdad o romper la conexión con Google Sheets.

Tu trabajo es hacer **cambios pequeños y seguros**, no mejorar, limpiar ni modernizar el proyecto.

---

## 0. Antes de empezar cualquier tarea

1. Lee `ARQUITECTURA.md` entera.
2. Si la tarea toca **enviar o leer datos** (guardar, borrar, sincronizar, pestañas, columnas, PDF en Drive, configuración, copias), lee además `referencia-apps-script.gs`.
3. Si la tarea es **visual**, lee `ESTILO.md`.
4. Busca en el código (búsqueda de texto) el nombre exacto de cada función o `id` que vayas a usar. **No te fíes de memoria ni de suposiciones.** Si no lo encuentras, dilo y pregunta.

---

## 1. Ediciones quirúrgicas (obligatorio)

- **Prohibido reescribir, regenerar o sustituir un archivo completo.** Aunque sea «más limpio» o «más rápido».
- Edita solo las **líneas mínimas necesarias** dentro de la función afectada.
- **Prohibido** reformatear, reindentar, reordenar, renombrar variables, cambiar comillas, eliminar comentarios o «limpiar código muerto» en zonas que no sean el cambio pedido.
- No muevas funciones de un archivo a otro. No dividas ni fusiones archivos.
- No cambies los saltos de línea ni la codificación de ningún archivo.
- Después de cada edición, revisa el **diff** y comprueba que solo han cambiado las líneas previstas. Si el diff muestra más cambios de los esperados, **deshaz y vuelve a intentarlo**.
- No crees archivos nuevos salvo que Miguel lo pida expresamente.

## 2. Antes de aplicar cualquier cambio: avisa en 3 líneas

Antes de modificar nada, escribe exactamente estas tres líneas y **espera mi OK**:

```
Archivo: <nombre del archivo>
Función/zona: <nombre de la función o bloque que voy a tocar>
Cambio: <qué haré, en una frase sencilla, y qué NO tocaré>
```

Si el cambio afecta a más de un archivo, indica cada uno por separado y explica por qué hace falta.
No apliques cambios hasta recibir confirmación.

## 3. Resuelve solo lo pedido

- Haz **únicamente** lo que se pide en este turno. Nada más.
- **No añadas mejoras, optimizaciones, refactorizaciones, comprobaciones extra ni «ya que estoy».**
- Si ves un fallo, una mejora o código raro fuera de lo pedido, **no lo arregles**: menciónalo en una línea al final y deja que Miguel decida.
- Si la petición es ambigua, **pregunta una sola cosa** antes de tocar nada. No elijas tú.
- Ante un fallo: **primero diagnostica y explica en texto** qué pasa y cómo lo repararías. **No escribas código hasta que Miguel diga «puedes escribir ya» o equivalente.**

---

## 4. Zonas de máximo cuidado: datos y Google Sheets

- **Nunca** cambies el nombre de una pestaña, columna, clave de configuración, acción del backend (`login`, `sync`, `save`, `delete`, `save_config`, etc.) ni campo de un registro. Los nombres exactos están en `ARQUITECTURA.md`.
- Todo envío al backend es **POST con `Content-Type: text/plain;charset=utf-8`**. Nunca cambies esto a JSON ni a otro tipo.
- Nunca hagas un `fetch` directo al backend desde un módulo: se usan las funciones del núcleo (`llamarBackend`, `guardarRegistro`, `borrarRegistro`, `sincronizar`, `confirmarConPin`).
- Si añades o cambias un campo que se guarda, **coteja los campos enviados contra las columnas reales** de la pestaña, en las dos direcciones. Un campo que no existe como columna se pierde **sin dar error**.
- No inventes columnas, pestañas, claves ni funciones. Si hace falta una nueva, **para y pregúntale a Miguel**: él tiene que crearla antes en Google Sheets.
- Los `id` no se cambian nunca. Los contactos reciben su número del backend; el resto los genera la pantalla con su prefijo (`pres-`, `fac-`, `fc-`, `apu-`, `pen-`, `imp-AAAA-Qn`...).
- Los valores que vienen de Sheets pueden ser números aunque parezcan texto: antes de usar `.replace()`, `.trim()`, `.split()`, `.localeCompare()`..., conviértelos con `String(valor || '')`.
- No uses `disabled` en campos de formulario cuyo valor haya que guardar.
- No quites el patrón de guardado actual: se apunta como pendiente **antes** de enviar, la ventana se cierra al instante y, si falla, queda en rojo y se reenvía (no se deshace).
- No toques el orden de arranque ni de sincronización en `app.js` (`syncReady` antes de los reconciliadores).

## 5. Fórmulas fiscales y contables 🔒

**Prohibido modificar** cualquier cálculo de dinero, impuestos o estimaciones (calculadora, presupuestos, facturas, apuntes, IVA, IRPF, «a adelantar», Inicio, redondeos) **salvo petición explícita de Miguel** con esas palabras. Si un cambio de otro tipo parece obligarte a tocarlas, **para y pregunta**.
Tampoco cambies los redondeos (se redondea a 2 decimales en cada paso) ni el orden de los cálculos.

## 6. Backend (`Código.gs`)

- `referencia-apps-script.gs` es una **copia de lectura sin claves**. No es el backend real: ese vive en Apps Script y solo Miguel puede publicarlo.
- **No puedes** publicar ni probar el backend. Si un cambio exige tocarlo, dilo claramente: dale a Miguel el cambio mínimo (las líneas exactas) y el paso a paso para pegarlo en Apps Script, y recuérdale publicar como **Nueva versión** de la implementación existente (nunca una implementación nueva).
- Si ves que `referencia-apps-script.gs` no coincide con lo que la app espera (por ejemplo, falta una pestaña en `SHEETS`), **avísalo**; no lo arregles por tu cuenta.

## 7. Seguridad (innegociable)

- **Nunca** escribas, pegues ni dejes en ningún archivo la clave de acceso, el PIN, el ID de la hoja de cálculo ni el ID de la carpeta de Drive. En copias del backend deben quedar `CAMBIAME` / `PEGA_AQUI_...`.
- Si encuentras alguno de esos valores reales en algún archivo, **para y avísame** sin copiarlo en ninguna respuesta.
- No hagas `git push`, no publiques en GitHub y no ejecutes comandos que envíen datos fuera del ordenador. Eso lo hace Miguel.
- No instales paquetes, no añadas dependencias, no enlaces librerías desde un CDN (las librerías van dentro del repositorio).
- No ejecutes comandos de borrado, formateo ni cambios masivos (buscar y reemplazar en todo el proyecto).

## 8. Reglas de despliegue que debes recordarme siempre

- Cada vez que cambies **cualquier archivo de la app**: recuérdame **subir el número `VERSION` de `sw.js`** (ejemplo: `cuentas-v86` → `cuentas-v87`) y súbelo tú como parte del cambio si te lo autorizo.
- Si el archivo es **nuevo**: además hay que añadirlo a `index.html` y a la lista `ARCHIVOS` de `sw.js`. Pero no crees archivos nuevos sin permiso (regla 1).
- Recuérdame esperar un par de minutos tras subir a GitHub antes de probar.

## 9. Cambios visuales

- Todo lo visual nuevo va en `tema.css`, **anclado a identificadores (`#id`)**, no a clases sueltas. `tema.css` debe seguir siendo el **último** CSS cargado.
- Los `id` deben ser **únicos en toda la app**, contando las ventanas que se abren encima. Antes de crear uno, búscalo en todo el proyecto.
- Todas las ventanas modales van en `z-index: 40`. No uses otro valor.
- No cambies colores, tipografías ni medidas de `ESTILO.md` salvo petición expresa.
- Comprueba siempre: móvil estrecho (320–360 px), PC, con las cifras ocultas (ojo cerrado) y que el PDF no cambia.

## 10. Cómo cerrar cada tarea

Al terminar, di en pocas líneas y sin jerga:
1. Qué has cambiado (archivo y función).
2. Cómo puedo comprobarlo yo en la app, paso a paso.
3. Si hay que subir `VERSION`, publicar el backend o crear algo en Sheets.
4. Cualquier cosa fuera de lo pedido que hayas visto pero **no** hayas tocado.

## 11. En caso de duda

**Para y pregunta.** Es mucho mejor una pregunta de más que un dato roto. Miguel decide rápido cuando se le presentan opciones claras en lenguaje sencillo.
