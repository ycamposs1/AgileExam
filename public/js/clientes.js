document.addEventListener("DOMContentLoaded", () => {
  // FECHAS
  const fechaInicioInput = document.getElementById('fechaInicio');
  const hoyISO = new Date().toISOString().split('T')[0];
  fechaInicioInput.value = hoyISO;

  document.getElementById("plazo").addEventListener("change", () => {
    const meses = parseInt(plazo.value);
    if (!meses) return;
    fechaFin.value = calcularFechaFin(hoyISO, meses);
  });

  // PESTAÑAS
  const tabLista = document.getElementById('tab-lista');
  const tabCrear = document.getElementById('tab-crear');
  const listaSection = document.getElementById('lista-section');
  const crearSection = document.getElementById('crear-section');

  tabLista.onclick = () => {
    tabLista.classList.add('active');
    tabCrear.classList.remove('active');
    listaSection.classList.add('active');
    crearSection.classList.remove('active');
    cargarClientes();
  };

  tabCrear.onclick = () => {
    tabCrear.classList.add('active');
    tabLista.classList.remove('active');
    crearSection.classList.add('active');
    listaSection.classList.remove('active');
  };

  // BOTÓN RECARGAR
  document.getElementById('btnRecargar').onclick = cargarClientes;
  cargarClientes();

  // BUSCAR DNI
  document.getElementById("buscarDNI").onclick = buscarDNI;

  // GUARDAR CLIENTE
  document.getElementById("crearForm").onsubmit = guardarCliente;

  // CONFIGURACIÓN DE TCEA
  const tipoPrestamoSelect = document.getElementById("tipoPrestamo");
  const tceaSelect = document.getElementById("tceaSelect");
  const tceaManualContainer = document.getElementById("tceaManualContainer");
  const tceaManual = document.getElementById("tceaManual");

  tipoPrestamoSelect.onchange = () => {
    const tipo = tipoPrestamoSelect.value;
    tceaSelect.innerHTML = "";
    if (!tipo) {
      tceaSelect.innerHTML = "<option value=''>Seleccione tipo de préstamo primero</option>";
      return;
    }
    const base = tiposTCEA[tipo];
    const opciones = [(base * 0.9).toFixed(3), base.toFixed(3), (base * 1.1).toFixed(3), "manual"];
    tceaSelect.innerHTML = `
      <option value="">Seleccione una opción</option>
      <option value="${opciones[0]}">${(opciones[0]*100).toFixed(1)}% (TCEA baja)</option>
      <option value="${opciones[1]}">${(opciones[1]*100).toFixed(1)}% (TCEA estándar)</option>
      <option value="${opciones[2]}">${(opciones[2]*100).toFixed(1)}% (TCEA alta)</option>
      <option value="manual">Ingresar manualmente</option>`;
    tceaManualContainer.style.display = "none";
  };

  tceaSelect.onchange = () => {
    tceaManualContainer.style.display = tceaSelect.value === "manual" ? "block" : "none";
  };
});

// ==== FUNCIONES ====
async function cargarClientes() {
  const msg = document.getElementById('msgLista');
  const tbody = document.querySelector('#tabla-clientes tbody');
  mostrarMensaje(msg, "Cargando lista...", "loading");

  try {
    const res = await fetch('/api/clientes', { cache: 'no-store' });
    const data = await res.json();
    if (!data.success || !data.clientes?.length) {
      mostrarMensaje(msg, "No hay clientes registrados.", "error");
      tbody.innerHTML = "";
      return;
    }
    msg.textContent = "";
    tbody.innerHTML = "";
    data.clientes.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.dni}</td>
        <td>${c.nombre}</td>
        <td>${Number(c.monto).toFixed(2)}</td>
        <td>${c.fecha_inicio || ''}</td>
        <td>${c.fecha_fin || ''}</td>
        <td class="actions"><button onclick="verDetalle('${c.dni}')">👁️ Ver</button></td>`;
      tbody.appendChild(tr);
    });
  } catch {
    mostrarMensaje(msg, "Error al cargar la lista.", "error");
  }
}

async function buscarDNI() {
  const dni = document.getElementById("dni").value.trim();
  const msgForm = document.getElementById("msgForm");
  if (dni.length !== 8) return mostrarMensaje(msgForm, "⚠️ DNI inválido", "error");

  mostrarMensaje(msgForm, "🔄 Consultando RENIEC...", "loading");
  try {
    const res = await fetch("/api/reniec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni }),
    });
    const data = await res.json();
    if (data.success && data.data) {
      const d = data.data;
      nombre.value = d.nombre_completo || "";
      nombres.value = d.nombres || "";
      apellidoP.value = d.apellido_paterno || "";
      apellidoM.value = d.apellido_materno || "";
      departamento.value = d.departamento || "";
      direccionCompleta.value = d.direccion_completa || "";
      mostrarMensaje(msgForm, "✅ Persona encontrada.", "success");
    } else mostrarMensaje(msgForm, "❌ No se encontró el DNI.", "error");
  } catch {
    mostrarMensaje(msgForm, "❌ Error al consultar RENIEC.", "error");
  }
}

async function guardarCliente(e) {
  e.preventDefault();
  const msgForm = document.getElementById("msgForm");
  mostrarMensaje(msgForm, "Guardando cliente...", "loading");

  const tceaValue = tceaSelect.value === "manual"
    ? parseFloat(tceaManual.value) / 100
    : parseFloat(tceaSelect.value);

  const body = {
    dni: dni.value.trim(),
    email: email.value.trim(),
    nombre: nombre.value.trim(),
    nombres: nombres.value.trim(),
    apellido_paterno: apellidoP.value.trim(),
    apellido_materno: apellidoM.value.trim(),
    departamento: departamento.value.trim(),
    direccion: direccionCompleta.value.trim(),
    monto: parseFloat(dinero.value),
    plazo: parseInt(plazo.value),
    tipo_prestamo: tipoPrestamo.value,
    tcea_aplicada: tceaValue,
    fecha_inicio: fechaInicio.value,
    fecha_fin: fechaFin.value
  };

  try {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    mostrarMensaje(msgForm, data.message, data.success ? "success" : "error");
    if (data.success) cargarClientes();
  } catch {
    mostrarMensaje(msgForm, "❌ Error al guardar cliente.", "error");
  }
}

window.verDetalle = async dni => {
  const modal = document.getElementById("modal");
  const detalle = document.getElementById("detalleCliente");
  try {
    const res = await fetch(`/api/clientes/${dni}`);
    const data = await res.json();
    if (!data.success || !data.cliente)
      detalle.innerHTML = "<p style='color:red;'>❌ Cliente no encontrado.</p>";
    else {
      const c = data.cliente;
      detalle.innerHTML = `
        <p><strong>DNI:</strong> ${c.dni}</p>
        <p><strong>Nombre:</strong> ${c.nombre}</p>
        <p><strong>Correo:</strong> ${c.email}</p>
        <p><strong>Monto:</strong> S/ ${c.monto}</p>
        <p><strong>Fecha inicio:</strong> ${c.fecha_inicio}</p>
        <p><strong>Fecha fin:</strong> ${c.fecha_fin}</p>`;
        
      btnEliminar.dataset.dni = c.dni;
    }
    modal.style.display = "flex";
  } catch {
    detalle.innerHTML = "<p style='color:red;'>❌ Error al obtener datos.</p>";
    modal.style.display = "flex";
  }
};

btnEliminar.onclick = async () => {
  const dni = btnEliminar.dataset.dni;
  if (!confirm("¿Eliminar cliente?")) return;
  try {
    const res = await fetch(`/api/clientes/${dni}`, { method: "DELETE" });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      cerrarModal();
      cargarClientes();
    }
  } catch {
    alert("❌ Error al eliminar cliente.");
  }
};

window.cerrarModal = () => {
  document.getElementById("modal").style.display = "none";
};
