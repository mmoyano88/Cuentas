# ESTILO VISUAL DE «CUENTAS»

Resumen de cómo está construido el diseño actual, para usarlo como base al preparar bocetos (Photoshop u otro) de un rediseño.
Fuentes: Diario del proyecto (INTERFAZ/DISEÑO) y `REDISENO_VISUAL_v1.md`. Los valores concretos (px, colores) conviene **confirmarlos en `tema.css`, `app.css` y los `mod-*.css`** antes de darlos por definitivos.

---

## 1. Cómo está hecho (tecnología)

- **CSS propio, a mano.** No usa Tailwind, Bootstrap ni ninguna librería de estilos. (La versión original v88 sí usaba Tailwind por CDN; la reconstrucción no.)
- Capas de CSS, en este orden de carga: `app.css` (base) → `mod-*.css` (uno por módulo) → **`tema.css` (el último, ganas siempre)**.
- `tema.css` contiene todo el aspecto del rediseño del 28/09/2026 y se ancla a identificadores (`#id`). Quitando su línea de `index.html`, la app vuelve al aspecto anterior.
- **Iconos:** Tabler Icons, estilo *outline* (trazo fino), alojados en el repositorio. Tamaños orientativos: menú 22–26 px, tabla 18 px, pastilla 13 px.
- **Gráficos:** Chart.js (líneas y donuts), alojado en el repositorio.
- **Diseño móvil primero (Android):** el PC es la versión ampliada. Corte principal en **900 px** (por debajo, barra inferior; por encima, barra lateral).
- Para bocetos, anchos de referencia: **390 px** (móvil), **768 px** (tablet) y **1280–1440 px** (PC). Probar también 320–360 px (móvil estrecho).

## 2. Idea central: cada color tiene un trabajo

| Color | Función | Dónde |
|---|---|---|
| **Negro** | El marco: «dónde estás» | Banda de cabecera, menú, tarjeta oscura del resumen económico, tarjeta del trimestre normal o pagado |
| **Rojo** | «Actúa aquí» / «ojo con esto» | Franja superior, botón principal, «+», cerrar, marca del menú activo (móvil), barrita de títulos de bloque, puntito de filtros activos, trimestre con 7 días o menos |
| **Blanco/claro** | El trabajo: los datos | Listas, fichas, formularios, tarjetas |
| **Colores de estado y de tarjeta** | Significado | Pastillas, tarjetas del Inicio |

El rojo **nunca** se usa como fondo grande. La app **no es modo oscuro**: es clara con marcos negros.

## 3. Paleta

**Estructura**
- Fondo de pantalla: `#F7F7F5`
- Texto principal: `#1A1A1A` · secundario: `#3A3A3A`
- Tarjetas y tablas: `#FFFFFF`
- Cabecera de tabla / fila marcada: `#EAEAE6`
- Banda de cabecera: `#161615`
- Barra de menú móvil y barra lateral PC: `#121211`
- Caja de datos del PDF: `#f4f5f7`

**Rojo de marca:** `#D32F2F` (icono de la app con degradado a `#A3241F`). Sobre fondo negro se usa el rojo claro `#FF6B60` / `#FF6B6B` (el normal no se lee).

**Estados de guardado (punto de 9 px):** verde `#3E9E4E` · ámbar `#E0A32E` · rojo `#D32F2F`.
**Indicador de sincronización sobre la banda (solo icono):** verde `#5EE08A`, azul `#6CB6FF` (girando), ámbar `#FFC24A`, rojo `#FF6B60`.

**Pastillas de estado** (fondo claro + texto oscuro del mismo tono, peso 600):
- Verde «Pagada»: fondo `#C0DD97`, texto `#173404`
- Ámbar «Pendiente»: fondo `#FAC775`, texto `#412402`
- Azul «Sincronizado»: fondo `#B5D4F4`, texto `#042C53`
- Rojo «Rechazada»: fondo `#F7C1C1`, texto `#501313`
- Gris «Archivada»: fondo `#D3D1C7`, texto `#2C2C2A`

**Ingreso / gasto:** verde (ingreso) y rojo (gasto), siempre; también en los círculos de Contabilidad.
**Texto de antigüedad de facturas sin cobrar:** gris, ámbar de texto `#A35F00` (desde 30 días) y rojo (desde 60).
**Línea «Total» del gráfico de evolución:** azul `#2F6FB5`; Empresa en rojo y Personal en morado `#7B4EA8`.
**Colores de categoría de plantillas:** azul (Fotografía), morado (Vídeo), verde azulado (Audio), naranja (Prensa y redes), rosa (Bodas y familia), ámbar (Eventos y empresas), gris oscuro (Cuotas y gastos). Sin rojo ni verde.
**Tarjetas de color del Inicio:** una por concepto (ingresos, gastos, beneficio, media, próximo pago, te deben); sus tonos exactos están en `mod-dashboard.js` (`DASH_TARJETAS_COLOR`).

## 4. Tipografías

- **Bricolage Grotesque, peso 800** (archivo local `bricolage-800.woff2`): títulos de pantalla y de ficha, nombres en tarjetas de plantilla y **cifras grandes** (tarjetas, totales, importes de las listas).
- **Texto general:** la fuente del resto de la interfaz no está fijada en los documentos que he usado (la v88 original usaba Inter). **Comprobar en `app.css`** el `font-family` real.
- **PDF** (aparte de la interfaz): Inter y Archivo Black, incrustadas.
- **Escala orientativa:** título de pantalla 20 px / 700 · título de tarjeta 15 px · texto de fila 13 px · cabecera de tabla 11 px / 600 · dato secundario 12 px · total destacado 22 px. **Mínimo 11 px en toda la app.**
- **Títulos de bloque:** 11 px, MAYÚSCULAS espaciadas, negrita, gris, con una **barrita roja** delante («ÚLTIMOS APUNTES», «LÍNEAS»...).
- Frase normal (no todo mayúsculas) en nombres de pestañas y secciones. La pantalla de arranque se llama **Inicio**, nunca «Dashboard».
- **Regla de las cifras:** el importe y el € van juntos y nunca saltan de línea; es el texto de al lado el que se recorta con «…».

## 5. Estructura de cada pantalla

De arriba abajo en Android: **franja roja** (barra de estado) → **banda negra** → contenido claro → **barra de menú casi negra** con marca roja en la sección activa.

**Banda negra de cabecera** (mismo alto en todas las pantallas):
- Imagen de marca (`cabecera-banda.webp`) a la derecha, oscurecida con degradado negro de izquierda a derecha.
- Título grande en blanco (Bricolage).
- Dos círculos gemelos a la derecha: **ojo** (ocultar cifras) y **sincronización**.
- Selector de la pantalla dentro de la banda si lo tiene (Ventas/Compras, Empresa/Personal/Total...): opción activa en blanco sólido, el resto atenuado.
- En **PC** la banda es una **tarjeta flotante** (esquinas ~20 px, margen ~12 px) para separarla de la barra lateral.

**Navegación**
- **PC:** barra lateral casi negra, ancho ~240 px, icono + nombre; sección activa con fondo blanco translúcido; arriba el icono de la app y «Cuentas». Orden: Inicio · Presupuestos, Pendiente, Facturas, Contabilidad, Impuestos · Clientes, Plantillas · (abajo, más pequeños) Mis datos, Configuración.
- **Android:** barra inferior casi negra con Inicio, Presupuestos, Pendiente, Facturas y Más. «Más» abre un panel claro con filas anchas.

**Estructura fija de un listado:** título + selector (en la banda) → buscador en píldora + botón de filtros redondo (con puntito rojo si hay filtros activos) → lista/tabla → botón «+» rojo flotante (móvil) o junto al buscador (PC).

## 6. Tarjetas, listas y tablas

- **Móvil:** cada registro es una **tarjeta/fila** blanca con icono circular, dato principal (nombre), dato secundario, importe en Bricolage y, a la derecha del todo, **botón de tres puntos** y **punto de color** de guardado.
- **PC:** los mismos datos en **tabla**: cabecera `#EAEAE6` con etiquetas pequeñas, importes alineados a la derecha en Bricolage, cabecera fija al desplazarse.
- **Fila de listado, siempre igual:** tres puntos (con TODAS las acciones dentro, cada una con icono) + punto de estado. No hay botones de acción sueltos.
- **Iconos de contacto:** círculo gris oscuro con el símbolo en trazo blanco (147 iconos disponibles).
- **Círculo de Contabilidad:** el **color** dice ingreso/gasto; el **icono** dice el origen (factura, impuesto, manual).
- **Plantillas:** pantalla de **tarjetas** (1 columna en móvil, 2 desde 640 px, 3 desde 1280 px), con cabecera teñida del color de su categoría.
- **Inicio:** tarjetas de color, carrusel de 12 tarjetas negras con el beneficio de cada mes, gráfico de líneas acumulado, donuts, y listas («Últimos apuntes», «Facturas sin cobrar», «Pendiente de facturar»).
- **Impuestos:** una **tarjeta por trimestre** (negra; roja con 7 días o menos o vencido), más tarjetas de IVA e IRPF. En móvil son **carruseles** deslizables; en PC, en fila.
- **Pantallas vacías:** icono grande de la sección en círculo gris, título corto y una línea de ayuda.

## 7. Fichas, ventanas y formularios

- **Ficha de detalle:** ventana **modal centrada** con fondo oscurecido, blanca. Cabecera con icono, nombre y pastilla de estado; cuerpo con datos en tarjeta; pie con dos botones: **lápiz en círculo** (editar) + **botón rojo ancho** de acción principal (el texto cambia según el módulo).
- **Botón de cerrar:** X blanca en círculo rojo, siempre en la misma esquina.
- **Resumen económico** (formularios y fichas): **tarjeta oscura** con desglose en pequeño y **TOTAL grande en blanco**. El rojo del formulario queda en el botón Guardar.
- **Formularios:** datos ya existentes (cliente, impuestos...) se eligen de desplegable o selector con buscador, nunca se reescriben. Totales en vivo.
- **Ventanas de confirmación y PIN:** icono arriba en círculo negro, título en Bricolage, botones en píldora.
- **Cierre:** las fichas de solo lectura se cierran al tocar fuera; los formularios con trabajo dentro, no.
- **Capas (`z-index`):** todas las ventanas modales en **40**; menús flotantes 25; filtros y «+» 15; diálogos del núcleo 50.

## 8. Botones y formas

- **Principal:** relleno rojo `#D32F2F`, texto blanco. **Secundario:** blanco con borde gris. **Menor:** texto plano.
- Forma de **píldora** (totalmente redondeados); alto base ~44 px.
- **Solo icono** para acciones universales (editar, cerrar, filtros, «+», copiar, compartir). **Icono + texto** para el botón rojo principal. **Solo texto** para Cancelar/Guardar y confirmaciones con PIN. Textos de botón de 1–2 palabras.
- Respuesta al pulsar: el botón se «hunde» ligeramente; en PC cambia de tono al pasar el ratón.
- **Esquinas:** tarjetas ~16 px, ventanas ~20 px, botones y selectores en píldora.
- **Márgenes:** padding lateral de página 20 px (móvil) / 24 px (PC); separación entre tarjetas 10–12 px en móvil y **16 px en PC**.
- **Desplegables:** todos con la misma flecha fina y gris. **Barras de desplazamiento** finas y oscuras en PC. **Texto seleccionado** en rojo claro.

## 9. Lo que NO es negociable al rediseñar (por funcionamiento)

- Las **cifras pueden ocultarse** con el ojo: cualquier diseño debe verse bien con importes tapados («•••••  €»).
- Importes largos (5 cifras con decimales) no deben desbordar en 320–360 px.
- El **PDF no usa este CSS**: se dibuja aparte (`mod-pdf-motor.js`); rediseñarlo es otro trabajo.
- Los **`id` de elementos** a los que se ancla `tema.css` deben ser únicos y no renombrarse sin avisar (un `id` repetido ya causó un fallo de «Personal» invisible).
- El selector de cada pantalla vive **dentro de la banda**; un selector nuevo necesita su `id` propio en `tema.css`.
- Hay datos que dependen de estas etiquetas: no cambiar los textos «Pendiente», «Pagada», «Aceptado»... sin revisar con `ARQUITECTURA.md`.

## 10. Consejos para preparar los bocetos de Photoshop

- Trabajar en **dos lienzos**: móvil 390 px de ancho y PC 1440 px.
- Mantener la regla «un color, un trabajo»: si el boceto usa rojo en algo que no sea «actúa aquí» o «ojo», avisar de por qué.
- Indicar en el boceto qué es **dato real** (cifra, nombre, fecha) y qué es **decoración**: lo decorativo debe justificar su función.
- Entregar al agente el boceto **junto con la lista de pantallas afectadas**, y pedir cambios **pantalla a pantalla**, empezando siempre por `tema.css`.
