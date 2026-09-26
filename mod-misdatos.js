/**
 * MÓDULO MIS DATOS (26/09/2026)
 * ------------------------------------------------------------
 * Pantalla de solo lectura con tus datos de facturación y de cobro,
 * para copiarlos o compartirlos cuando un cliente te los pide.
 *
 * - Lee lo que ya está en Configuración → Mis Datos (más el IBAN, que
 *   se añadió allí el mismo día). No guarda nada ni escribe en Sheets.
 * - Con el ojo de la cabecera tachado, los datos se tapan en pantalla
 *   (menos el nombre). Copiar y Compartir dan siempre los datos
 *   reales: el ojo solo protege lo que se ve.
 * - Compartir usa el menú de compartir del propio sistema (WhatsApp,
 *   correo...). Con texto funciona en Android y en Chrome/Edge de PC;
 *   si el navegador no lo admite, el botón no aparece.
 *
 * Debe cargarse DESPUÉS de mod-navegacion.js en index.html.
 */

// ============================================================
// 1. DATOS
// ============================================================

function mdTexto(clave) {
  const v = estado.configuracion[clave];
  return v === undefined || v === null ? '' : String(v).trim();
}

function mdDireccion() {
  const linea1 = [mdTexto('fiscal_calle'), mdTexto('fiscal_numero')].filter(Boolean).join(' ');
  const linea2 = [mdTexto('fiscal_codigo_postal'), mdTexto('fiscal_poblacion')].filter(Boolean).join(' ');
  const provincia = mdTexto('fiscal_provincia');
  return [linea1, linea2 + (provincia ? ' (' + provincia + ')' : '')].filter(Boolean).join(', ');
}

// IBAN en grupos de 4, como se escribe siempre: ES00 0000 0000 ...
function mdIbanLegible(iban) {
  const limpio = String(iban || '').replace(/\s+/g, '').toUpperCase();
  return limpio.replace(/(.{4})/g, '$1 ').trim();
}

function mdDatosFacturacion() {
  return [
    { etiqueta: 'Nombre', valor: mdTexto('fiscal_nombre'), visible: true },
    { etiqueta: 'NIF', valor: mdTexto('fiscal_nif') },
    { etiqueta: 'Dirección', valor: mdDireccion() },
    { etiqueta: 'Teléfono', valor: mdTexto('perfil_telefono') },
    { etiqueta: 'Email', valor: mdTexto('perfil_email') }
  ].filter(function (d) { return d.valor; });
}

function mdDatosCobro() {
  const iban = mdIbanLegible(mdTexto('fiscal_iban'));
  if (!iban) return [];
  return [
    { etiqueta: 'Titular', valor: mdTexto('fiscal_nombre'), visible: true },
    { etiqueta: 'IBAN', valor: iban }
  ].filter(function (d) { return d.valor; });
}

// Texto que se copia o se comparte.
function mdTextoBloque(titulo, datos) {
  if (!datos.length) return '';
  return titulo + '\n' + datos.map(function (d) { return d.etiqueta + ': ' + d.valor; }).join('\n');
}

function mdTextoFacturacion() { return mdTextoBloque('DATOS DE FACTURACIÓN', mdDatosFacturacion()); }
function mdTextoCobro() { return mdTextoBloque('DATOS DE COBRO', mdDatosCobro()); }
function mdTextoTodo() { return [mdTextoFacturacion(), mdTextoCobro()].filter(Boolean).join('\n\n'); }

// ============================================================
// 2. OCULTAR CON EL OJO
// ============================================================
// Se deja ver el final (los 4 últimos caracteres) de NIF, teléfono e
// IBAN, para reconocerlos sin enseñarlos. Dirección y email, enteros
// tapados.

function mdValorVisible(d) {
  if (!cifrasOcultas || d.visible) return d.valor;
  if (d.etiqueta === 'Dirección' || d.etiqueta === 'Email') return '••••••••';
  const sinEspacios = d.valor.replace(/\s+/g, '');
  return '•••• ' + sinEspacios.slice(-4);
}

// ============================================================
// 3. COPIAR Y COMPARTIR
// ============================================================

function mdPuedeCompartir() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

async function mdCopiar(texto, boton) {
  let bien = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      bien = true;
    }
  } catch (err) {
    bien = false;
  }
  if (!bien) {
    // Plan B para navegadores que no dejan usar el portapapeles directo.
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { bien = document.execCommand('copy'); } catch (err) { bien = false; }
    area.remove();
  }
  if (!bien) {
    alert('No se ha podido copiar. Prueba con el botón Compartir.');
    return;
  }
  const original = boton.innerHTML;
  boton.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i><span>Copiado</span>';
  boton.disabled = true;
  setTimeout(function () { boton.innerHTML = original; boton.disabled = false; }, 1500);
}

async function mdCompartir(texto) {
  try {
    await navigator.share({ title: 'Mis datos', text: texto });
  } catch (err) {
    // Cerrar el menú de compartir sin elegir nada no es un error.
    if (err && err.name === 'AbortError') return;
    console.error('No se pudo compartir:', err);
    alert('No se ha podido compartir. Prueba con el botón Copiar.');
  }
}

// ============================================================
// 4. PANTALLA
// ============================================================

function mdBotones(que) {
  return '<div class="md-botones">' +
    '<button type="button" class="boton-secundario md-boton" data-copiar="' + que + '">' +
      '<i class="ti ti-copy" aria-hidden="true"></i><span>Copiar</span></button>' +
    (mdPuedeCompartir()
      ? '<button type="button" class="boton-secundario md-boton" data-compartir="' + que + '">' +
          '<i class="ti ti-share" aria-hidden="true"></i><span>Compartir</span></button>'
      : '') +
  '</div>';
}

function mdTarjeta(titulo, icono, datos, que, vacio) {
  return '<section class="md-tarjeta">' +
    '<h2 class="md-tarjeta-titulo"><i class="ti ' + icono + '" aria-hidden="true"></i>' + escaparHtml(titulo) + '</h2>' +
    (datos.length
      ? '<dl class="md-datos">' + datos.map(function (d) {
          return '<div class="md-dato"><dt>' + escaparHtml(d.etiqueta) + '</dt><dd>' + escaparHtml(mdValorVisible(d)) + '</dd></div>';
        }).join('') + '</dl>' + mdBotones(que)
      : '<p class="md-vacio">' + escaparHtml(vacio) + '</p>' +
        '<button type="button" class="boton-secundario" data-ir-config="1">Ir a Configuración</button>') +
  '</section>';
}

function pintarMisDatos() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  const facturacion = mdDatosFacturacion();
  const cobro = mdDatosCobro();
  const hayAlgo = facturacion.length > 0 || cobro.length > 0;

  contenido.innerHTML =
    '<div class="md-pantalla">' +
      '<p class="md-nota">Para enviar a un cliente cuando te pide tus datos. Se cambian en Configuración → Mis Datos.</p>' +
      '<div class="md-tarjetas">' +
        mdTarjeta('Datos de facturación', 'ti-file-invoice', facturacion, 'facturacion',
          'Todavía no has rellenado tus datos.') +
        mdTarjeta('Datos de cobro', 'ti-building-bank', cobro, 'cobro',
          'Añade tu IBAN en Configuración → Mis Datos para poder copiarlo desde aquí.') +
      '</div>' +
      (hayAlgo && facturacion.length && cobro.length
        ? '<section class="md-tarjeta md-todo">' +
            '<h2 class="md-tarjeta-titulo"><i class="ti ti-stack-2" aria-hidden="true"></i>Todo junto</h2>' +
            mdBotones('todo') +
          '</section>'
        : '') +
      (cifrasOcultas && hayAlgo
        ? '<p class="md-nota md-nota-ojo"><i class="ti ti-eye-off" aria-hidden="true"></i> Los datos están tapados en pantalla, pero Copiar y Compartir dan los datos completos.</p>'
        : '') +
    '</div>';

  const textos = { facturacion: mdTextoFacturacion, cobro: mdTextoCobro, todo: mdTextoTodo };

  contenido.querySelectorAll('[data-copiar]').forEach(function (b) {
    b.addEventListener('click', function () { mdCopiar(textos[b.dataset.copiar](), b); });
  });
  contenido.querySelectorAll('[data-compartir]').forEach(function (b) {
    b.addEventListener('click', function () { mdCompartir(textos[b.dataset.compartir]()); });
  });
  contenido.querySelectorAll('[data-ir-config]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof configPestanaActiva !== 'undefined') configPestanaActiva = 'mis-datos';
      cambiarVista('configuracion');
    });
  });
}

// ============================================================
// 5. REGISTRO COMO VISTA
// ============================================================

registrarVista('misdatos', {
  titulo: 'Mis datos',
  pintar: pintarMisDatos
});
