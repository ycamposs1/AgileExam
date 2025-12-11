console.log("CLIENTES.JS v3 LOADED");
document.addEventListener("DOMContentLoaded", () => {
  // FECHAS
  const fechaInicioInput = document.getElementById('fechaInicio');
  const hoyISO = new Date().toISOString().split('T')[0];
  fechaInicioInput.value = hoyISO;
  fechaInicioInput.min = hoyISO; // Restrict to today onwards

  // Recalcular fecha fin si cambia inicio o plazo
  function actualizarFechaFin() {
    const inicio = fechaInicioInput.value;
    const meses = parseInt(document.getElementById("plazo").value);
    if (inicio && meses) {
      document.getElementById("fechaFin").value = calcularFechaFin(inicio, meses);
    }
  }

  fechaInicioInput.addEventListener("change", actualizarFechaFin);
  document.getElementById("plazo").addEventListener("input", actualizarFechaFin);

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

  // LOGICA PARA HABILITAR INPUTS DE TASAS Y ESTILOS
  document.querySelectorAll('.rate-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const type = e.target.value;
      const input = document.getElementById(`input${type}`);
      const container = document.getElementById(`container${type}`);
      const card = e.target.closest('.rate-card');

      if (e.target.checked) {
        if (container) container.style.display = 'flex';
        input.required = true;
        if (card) card.classList.add('active');
        input.focus();
      } else {
        if (container) container.style.display = 'none';
        input.value = '';
        input.required = false;
        if (card) card.classList.remove('active');
      }
    });
  });

  helpTexts = { // Placeholder empty as help logic changed
  };

  tipoTasaSelect = { onchange: null }; // Dummy to prevent errors from removed logic
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
        <tr>
          <td>${c.dni}</td>
          <td>${c.nombre}</td>
          <td>${c.tipo_prestamo || '-'}</td>
          <td>${(c.tcea_aplicada * 100).toFixed(2)}% (${c.tipo_tasa || 'TEA'})</td>
          <td>${c.plazo || '-'}</td>
          <td>S/ ${c.cuota_mensual}</td>
          <td>S/ ${c.total_pagar}</td>
          <td>${c.fecha_inicio || ''}</td>
          <td>${c.fecha_fin || ''}</td>
          <td class="actions">
            <button onclick="verDetalle('${c.dni}')">👁️ Ver</button>
            <button onclick="verCronograma('${c.dni}')">📅 Cronograma</button>
          </td>
          <td>${c.tipo}</td>
          <td>${c.origen || '-'}</td>
          <td>${c.destino || '-'}</td>
        </tr>
      `;
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

  // Objeto temporal para logica
  const bodyObj = {
    nombre: document.getElementById("nombre").value.trim(),
    apellido_paterno: document.getElementById("apellidoP").value.trim(),
    monto: parseFloat(document.getElementById("dinero").value),
    tasas_detalle: [],
    tcea_aplicada: 0
  };

  // Procesar checkboxes
  const checks = document.querySelectorAll('.rate-check:checked');
  if (checks.length === 0) {
    alert("⚠️ Seleccione al menos un tipo de tasa.");
    return;
  }

  let totalTasa = 0;
  checks.forEach(chk => {
    const val = parseFloat(document.getElementById(`input${chk.value}`).value);
    if (!isNaN(val)) {
      bodyObj.tasas_detalle.push({ tipo: chk.value, valor: val });
      totalTasa += val;
    }
  });
  bodyObj.tcea_aplicada = totalTasa / 100;

  // Confirmación requerida
  const detalleTasasStr = bodyObj.tasas_detalle.map(t => `${t.tipo}: ${t.valor}%`).join(', ');
  const msgConf = `📝 CONFIRMACIÓN DE CREACIÓN\n\n` +
    `Cliente: ${bodyObj.nombre} ${bodyObj.apellido_paterno}\n` +
    `Monto: S/ ${bodyObj.monto}\n` +
    `Tasas Aplicadas: ${detalleTasasStr}\n` +
    `Total Interés Acumulado: ${totalTasa}%\n\n` +
    `¿Desea crear el cliente?`;

  if (!confirm(msgConf)) return;

  // Determine primary rate label
  const mainRates = bodyObj.tasas_detalle.filter(t => t.tipo !== 'ITF');
  let labelTasa = "MULTIPLE";
  if (mainRates.length === 1) {
    labelTasa = mainRates[0].tipo;
  }

  const body = {
    dni: document.getElementById("dni").value.trim(),
    email: document.getElementById("email").value.trim(),
    nombre: document.getElementById("nombre").value.trim(),
    nombres: document.getElementById("nombres").value.trim(),
    apellido_paterno: document.getElementById("apellidoP").value.trim(),
    apellido_materno: document.getElementById("apellidoM").value.trim(),
    departamento: document.getElementById("departamento").value,
    direccion: document.getElementById("direccionCompleta").value.trim(),
    monto: parseFloat(document.getElementById("dinero").value),
    plazo: parseInt(document.getElementById("plazo").value),
    tipo_prestamo: "Personal",
    tasas_detalle: JSON.stringify(bodyObj.tasas_detalle), // Send as JSON string
    tcea_aplicada: bodyObj.tcea_aplicada,
    tipo_tasa: labelTasa,
    fecha_inicio: document.getElementById("fechaInicio").value,
    fecha_fin: document.getElementById("fechaFin").value,
    tipo: document.getElementById("tipoCliente").value,
    origen: document.getElementById("origenFondos").value.trim(),
    destino: document.getElementById("destinoFondos").value.trim()
  };

  try {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    mostrarMensaje(msgForm, data.message, data.success ? "success" : "error");
    if (data.success) {
      document.getElementById("crearForm").reset();
      setTimeout(() => {
        document.getElementById('tab-lista').click();
      }, 1500);
    }
  } catch {
    mostrarMensaje(msgForm, "❌ Error al guardar cliente.", "error");
  }
}

// ========= CRONOGRAMA =========
async function verCronograma(dni) {
  const modal = document.getElementById("modalCronograma");
  const contenido = document.getElementById("cronogramaContenido");

  contenido.innerHTML = "<p class='loading'>Cargando cronograma...</p>";
  modal.style.display = "flex";

  try {
    const res = await fetch(`/api/clientes/${dni}/cronograma`);
    const data = await res.json();

    if (!data.success) {
      contenido.innerHTML = `<p class='error'>${data.message}</p>`;
      return;
    }

    let html = `
      <p><strong>Cuota mensual:</strong> S/ ${data.cuota}</p>
      <p><strong>Total a pagar:</strong> S/ ${data.total_pagar}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <thead>
          <tr style="background:#0c2340;color:white;">
            <th>N°</th><th>Fecha Pago</th><th>Cuota (S/)</th><th>Interés</th><th>Amortización</th><th>Saldo</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.cronograma.forEach(cuota => {
      html += `
        <tr>
          <td>${cuota.nro}</td>
          <td>${cuota.fecha_pago}</td>
          <td>${cuota.cuota}</td>
          <td>${cuota.interes}</td>
          <td>${cuota.amortizacion}</td>
          <td>${cuota.saldo}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";

    contenido.innerHTML = html;
  } catch (err) {
    contenido.innerHTML = "<p class='error'>❌ Error al obtener cronograma.</p>";
    console.error(err);
  }
}

function cerrarModalCronograma() {
  document.getElementById("modalCronograma").style.display = "none";
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
      const i = Math.pow(1 + parseFloat(c.tcea_aplicada), 1 / 12) - 1;
      const cuotaCal = c.monto * (i / (1 - Math.pow(1 + i, -c.plazo)));
      const totalOriginalConInteres = cuotaCal * c.plazo;

      // Calculate remaining debt based on principal payments
      // Assuming backend reduces saldo_pendiente by the payment amount
      const saldoPrincipalActual = c.saldo_pendiente !== null ? parseFloat(c.saldo_pendiente) : parseFloat(c.monto);
      const totalPagadoCapital = parseFloat(c.monto) - saldoPrincipalActual;

      const fondoIndividual = c.fondo_individual ? parseFloat(c.fondo_individual) : 0;

      // The user wants to see the Total Debt (with Interest) reducing as they pay.
      // So we subtract what they've "paid off" (based on principal reduction) from the Total Original Debt
      // AND we subtract what is held in Individual Fund.
      let deudaMostrar = totalOriginalConInteres - totalPagadoCapital - fondoIndividual;
      if (deudaMostrar < 0) deudaMostrar = 0;

      let tasasHtml = "";
      try {
        if (c.tasas_detalle) {
          const tasasObj = JSON.parse(c.tasas_detalle);
          if (Array.isArray(tasasObj) && tasasObj.length > 0) {
            tasasHtml = "<div><p><strong>Tasas Aplicadas:</strong></p><ul style='margin-top:0;padding-left:20px;'>";
            tasasObj.forEach(t => {
              tasasHtml += `<li>${t.tipo}: ${t.valor}%</li>`;
            });
            tasasHtml += "</ul></div>";
          }
        }
      } catch (e) { console.error("Error parsing tasas", e); }

      // const deuda ... replaced by calculation above

      // 🔹 Lógica Cuota Inteligente
      let cuotaRestante = cuotaCal - fondoIndividual;
      if (cuotaRestante < 0) cuotaRestante = 0; // Por si acaso

      // 🔹 Lógica Número de Cuota
      const fechaInicio = new Date(c.fecha_inicio);
      const hoy = new Date();
      // Diferencia en meses
      let mesesTranscurridos = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
      // Ajuste: si el día actual es menor al día de inicio, no ha pasado el mes completo
      if (hoy.getDate() < fechaInicio.getDate()) {
        mesesTranscurridos--;
      }
      const nroCuotaActual = mesesTranscurridos + 1;

      // 🟢 Mostrar Número de Cuota en UI
      const infoCuotaHtml = `<div style="grid-column: span 2; background:#e8f5e9; padding:8px; border-radius:5px; text-align:center;">
          <strong>📅 Cuota Actual:</strong> #${nroCuotaActual} de ${c.plazo}
      </div>`;

      // 🔹 Lógica Historial de Pagos
      console.log("Historial recibido:", data.historial); // DEBUG

      let historialHtml = `
          <div style="margin-top:20px; text-align:left;">
              <h4 style="margin-bottom:10px;">📜 Historial de Pagos Recientes</h4>
              <div style="max-height:150px; overflow-y:auto; border:1px solid #eee;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
                      <thead style="background:#f8f9fa;">
                          <tr>
                              <th style="padding:5px; text-align:left;">Fecha</th>
                              <th style="padding:5px; text-align:left;">Tipo</th>
                              <th style="padding:5px; text-align:right;">Monto</th>
                          </tr>
                      </thead>
                      <tbody>
      `;

      if (data.historial && data.historial.length > 0) {
        data.historial.forEach(h => {
          historialHtml += `
                  <tr style="border-bottom:1px solid #eee;">
                      <td style="padding:5px;">${h.fecha}</td>
                      <td style="padding:5px;">${h.tipo}</td>
                      <td style="padding:5px; text-align:right;">S/ ${parseFloat(h.monto).toFixed(2)}</td>
                  </tr>
              `;
        });
      } else {
        historialHtml += `<tr><td colspan="3" style="padding:10px; text-align:center; color:#777;">Sin movimientos recientes</td></tr>`;
      }
      historialHtml += `</tbody></table></div></div>`;

      // 🟢 Mostrar Fondo Individual
      const infoFondoHtml = `
      <div style="grid-column: span 2; background:#e3f2fd; padding:8px; border-radius:5px; text-align:center; display:flex; justify-content:space-between; align-items:center;">
          <span>💰 <strong>Fondo Individual Acumulado:</strong></span>
          <span style="font-size:1.1em; color:#1565c0; font-weight:bold;">S/ ${fondoIndividual.toFixed(2)}</span>
      </div>`;

      detalle.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div><p><strong>DNI:</strong> ${c.dni}</p></div>
          <div><p><strong>Nombre:</strong> ${c.nombre}</p></div>
          <div><p><strong>Monto Original:</strong> S/ ${c.monto}</p></div>
          <div><p><strong>Plazo:</strong> ${c.plazo} meses</p></div>
          <div><p><strong>Tasa Global (TCEA):</strong> ${(c.tcea_aplicada * 100).toFixed(2)}%</p></div>
          <div><p><strong>Cuota Mensual Ref:</strong> S/ ${cuotaCal.toFixed(2)}</p></div>
          ${infoCuotaHtml}
          ${infoFondoHtml}
        </div>
        ${tasasHtml}
        
        ${historialHtml}

        <hr>
        <div style="text-align:center; margin:10px 0;">
          <p style="font-size:1.2em;"><strong>Total a pagar (con intereses)</strong></p>
          <p style="font-size:1.5em; color:#d9534f; font-weight:bold;">S/ ${deudaMostrar.toFixed(2)}</p>
        </div>
        
        <!-- Input de Monto Variable con Validación -->
        <div style="margin-top:15px; padding:10px; background:#fff3cd; border:1px solid #ffeeba; border-radius:5px;">
             <label style="display:block; font-weight:bold; margin-bottom:5px;">Monto Variable (S/):</label>
             <input type="number" id="inputMontoVariable" step="0.01" placeholder="Ingrese monto..." style="width:100%; padding:8px; box-sizing:border-box;">
             <small style="color:#856404;">Máximo permitido: S/ ${deudaMostrar.toFixed(2)}</small>
        </div>
        
        <input type="hidden" id="deudaActual" value="${deudaMostrar}">
        <input type="hidden" id="cuotaMensual" value="${cuotaRestante.toFixed(2)}">

        <!-- Botones de Pago Dinámicos -->
        <div style="margin-top:20px; border-top:1px solid #ccc; padding-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
           <button id="btnPagarCuota" style="background:#007bff; color:white; border:none; border-radius:4px; flex:1; padding:12px; cursor:pointer;">Pagar Cuota</button>
           <button id="btnPagarTotal" style="background:#28a745; color:white; border:none; border-radius:4px; flex:1; padding:12px; cursor:pointer;">Liquidar Deuda Total</button>
        </div>
      `;

      // Configurar botones de pago
      const btnCuota = document.getElementById("btnPagarCuota");
      const btnTotal = document.getElementById("btnPagarTotal");
      const inputVariable = document.getElementById("inputMontoVariable");

      // 🛑 Validación del Input Monto Variable
      if (inputVariable) {
        inputVariable.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (val > deudaMostrar) {
            alert(`⚠️ El monto no puede ser mayor a la deuda total (S/ ${deudaMostrar.toFixed(2)})`);
            e.target.value = deudaMostrar.toFixed(2);
          }
        });
      }

      // Lógica de Botón Cuota: SIEMPRE DISPONIBLE si hay deuda
      if (btnCuota) {
        btnCuota.dataset.dni = c.dni;

        // Si el usuario escribe en el input variable, el botón usa ese monto
        btnCuota.onclick = () => {
          const montoVar = parseFloat(document.getElementById("inputMontoVariable").value);
          if (montoVar > 0) {
            realizarPago(c.dni, montoVar, "Pago Variable");
          } else {
            // Si no hay monto variable, usa la cuota por defecto (o lo que quede)
            realizarPago(c.dni, cuotaRestante > 0 ? cuotaRestante : cuotaCal, "Pago de Cuota");
          }
        };

        // Texto del botón
        if (cuotaRestante <= 0.10) {
          // Si ya cubrió la cuota del mes, sugerimos pagar la siguiente o un monto libre
          btnCuota.innerHTML = `Pagar Cuota / Adelantar<br><small>(Ingrese Monto Arriba)</small>`;
          // NO DESHABILITAR - Permitir pagos adicionales
          btnCuota.disabled = false;
          btnCuota.style.backgroundColor = "";
        } else {
          btnCuota.innerHTML = `Pagar Cuota Mes<br><small>S/ ${cuotaRestante.toFixed(2)}</small>`;
          btnCuota.disabled = false;
          btnCuota.style.backgroundColor = "";
        }
      }

      if (btnTotal) {
        btnTotal.dataset.dni = c.dni;
        btnTotal.innerHTML = `Liquidar Deuda Total<br><small>S/ ${deudaMostrar.toFixed(2)}</small>`;

        btnTotal.onclick = () => {
          realizarPago(c.dni, deudaMostrar, "Liquidación Total");
        };
      }

    }
    modal.style.display = "flex";
  } catch (err) {
    console.error("Error mostrando detalle:", err);
    alert("Error al cargar los detalles del cliente. Ver consola.");
  }
};


// 💰 PAGO CUOTA


async function realizarPago(dni, monto, concepto) {
  if (!confirm(`¿Confirmar pago de ${concepto}:\nS/ ${monto.toFixed(2)}?`)) return;

  try {
    const res = await fetch(`/api/clientes/${dni}/pago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montoPago: monto }) // Solo enviamos el monto, sin tasas extras
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      cerrarModal();
      cargarClientes();
    }
  } catch (err) {
    console.error(err);
    alert("❌ Error al procesar pago.");
  }
}

window.cerrarModal = () => {
  document.getElementById("modal").style.display = "none";
};

// Mostrar / ocultar campos PEP según el tipo seleccionado
const tipoCliente = document.getElementById("tipoCliente");
const camposPEP = document.getElementById("camposPEP");

tipoCliente.addEventListener("change", () => {
  if (tipoCliente.value === "pep") {
    camposPEP.style.display = "block";
  } else {
    camposPEP.style.display = "none";
    document.getElementById("origenFondos").value = "";
    document.getElementById("destinoFondos").value = "";
  }
});
