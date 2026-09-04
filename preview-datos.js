localStorage.setItem('cuentas_clave_v1', 'preview');

const CLIENTES_EJEMPLO = [
  { id: 1, nombre_contacto: 'Ayuntamiento de Pozoblanco', nombre_fiscal: 'Ayuntamiento de Pozoblanco', nif: 'P1405600G', calle: 'Plaza España', numero: '1', codigo_postal: '14400', poblacion: 'Pozoblanco', provincia: 'Córdoba', telefono: '957 100 000', mail: 'prensa@pozoblanco.es', tipo: 'ayuntamiento_pequeno', rol: 'cliente', estado: 'activo', icono: 'building-bank' },
  { id: 2, nombre_contacto: 'Laura Gómez', nombre_fiscal: 'Laura Gómez Estudio Fotográfico', nif: '30500000A', calle: 'Calle Mayor', numero: '12', codigo_postal: '14400', poblacion: 'Pozoblanco', provincia: 'Córdoba', telefono: '600 111 222', mail: 'laura@estudio.com', tipo: 'profesional', rol: 'ambos', estado: 'activo', icono: 'camera' },
  { id: 3, nombre_contacto: 'La Nao', nombre_fiscal: 'La Nao Eventos Náuticos S.L.', nif: 'B14555555', calle: '', numero: '', codigo_postal: '', poblacion: 'Córdoba', provincia: 'Córdoba', telefono: '600 555 666', mail: 'info@lanao.com', tipo: '', rol: 'proveedor', estado: 'activo', icono: 'sailboat' },
  { id: 4, nombre_contacto: 'María Ruiz', nombre_fiscal: 'María Ruiz Pérez', nif: '30511111B', calle: 'Av. Andalucía', numero: '4', codigo_postal: '14400', poblacion: 'Pozoblanco', provincia: 'Córdoba', telefono: '600 333 444', mail: '', tipo: 'habitual', rol: 'cliente', estado: 'activo', icono: 'user' },
  { id: 5, nombre_contacto: 'Sin icono todavía', nombre_fiscal: 'Contacto sin icono elegido', nif: '30599999Z', calle: '', numero: '', codigo_postal: '', poblacion: '', provincia: '', telefono: '', mail: '', tipo: 'normal', rol: 'cliente', estado: 'activo' }
];

async function llamarBackend(cuerpo) {
  if (cuerpo.action === 'load') {
    return {
      status: 'success',
      datos: {
        configuracion: [
          { clave: 'tipos_cliente', valor: JSON.stringify([
            { nombre: 'normal', etiqueta: 'Normal', ajuste: 0 },
            { nombre: 'profesional', etiqueta: 'Profesional', ajuste: -5 },
            { nombre: 'habitual', etiqueta: 'Cliente habitual', ajuste: -8 },
            { nombre: 'ayuntamiento_pequeno', etiqueta: 'Ayuntamiento pequeño', ajuste: 2 }
          ]) }
        ],
        clientes: CLIENTES_EJEMPLO,
        presupuestos: [], presupuestos_detalle: [], ventas: [], ventas_detalle: [],
        compras: [], apuntes: [], impuestos: []
      }
    };
  }
  if (cuerpo.action === 'save') {
    return { status: 'success', data: cuerpo.data.id ? cuerpo.data : Object.assign({}, cuerpo.data, { id: Math.floor(Math.random() * 1000) + 10 }) };
  }
  return { status: 'success' };
}
