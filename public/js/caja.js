const denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10];
let currentSession = null;

document.addEventListener("DOMContentLoaded", () => {
    cargarEstado();
    generarInputsBilletes();
});

// 1. CARGAR ESTADO
async function cargarEstado() {
    try {
        const res = await fetch('/api/caja/estado');
        const data = await res.json();

        if (data.success) {
            if (data.abierta) {
                currentSession = data.sesion;
                mostrarVista('viewOpen');
                actualizarDashboard(data);
            } else {
                mostrarVista('viewClosed');
            }
        }
    } catch (e) {
        console.error("Error cargando estado:", e);
        alert("Error de conexión con el servidor.");
    }
}

// 2. ABRIR CAJA
async function abrirCaja() {
    const monto = parseFloat(document.getElementById('openAmount').value);
    if (isNaN(monto) || monto < 0) return alert("Ingrese un monto válido");

    if (!confirm("¿Confirmar apertura de caja?")) return;

    try {
        const res = await fetch('/api/caja/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldoInicial: monto })
        });
        const data = await res.json();
        if (data.success) {
            location.reload();
        } else {
            alert(data.message);
        }
    } catch (e) { console.error(e); }
}

// 3. DASHBOARD
function actualizarDashboard(data) {
    const s = data.sesion;
    document.getElementById('openDate').innerText = new Date(s.fecha_apertura).toLocaleString();
    document.getElementById('lblSaldoInicial').innerText = `S/ ${s.saldo_inicial.toFixed(2)}`;

    // Calcular ingresos/egresos desde data.movimientos
    let ing = 0, egr = 0;
    const list = document.getElementById('movementsList');
    list.innerHTML = "";

    data.movimientos.forEach(m => {
        if (m.tipo === 'INGRESO') ing += m.monto;
        else egr += m.monto;

        // Add to list
        const li = document.createElement('li');
        li.style.borderBottom = "1px solid #eee";
        li.style.padding = "5px";
        li.innerHTML = `
            <small style="color:#888">${new Date(m.fecha).toLocaleTimeString()}</small>
            <b>${m.tipo}</b>: S/ ${m.monto.toFixed(2)} <br>
            <span style="color:#555; font-size:0.9em;">${m.descripcion || ''}</span>
        `;
        list.appendChild(li);
    });

    document.getElementById('lblIngresos').innerText = `+ S/ ${ing.toFixed(2)}`;
    document.getElementById('lblEgresos').innerText = `- S/ ${egr.toFixed(2)}`;

    const teorico = s.saldo_inicial + ing - egr;
    document.getElementById('lblSaldoTeorico').innerText = `S/ ${teorico.toFixed(2)}`;
}

// 4. PREPARAR CIERRE
function iniciarCierre() {
    mostrarVista('viewClosing');
}

function cancelarCierre() {
    mostrarVista('viewOpen');
}

function generarInputsBilletes() {
    const container = document.getElementById('billsContainer');
    container.innerHTML = "";

    denominations.forEach(val => {
        const div = document.createElement('div');
        div.className = 'bill-item';
        div.innerHTML = `
            <label>S/ ${val.toFixed(2)}</label>
            <input type="number" min="0" class="bill-input" data-val="${val}" placeholder="0" oninput="calcularTotalFisico()">
        `;
        container.appendChild(div);
    });
}

function calcularTotalFisico() {
    let total = 0;
    document.querySelectorAll('.bill-input').forEach(inp => {
        const count = parseInt(inp.value) || 0;
        const val = parseFloat(inp.dataset.val);
        total += count * val;
    });
    document.getElementById('lblTotalContado').innerText = `S/ ${total.toFixed(2)}`;
    return total;
}

// 5. CONFIRMAR CIERRE
async function confirmarCierre() {
    const totalFisico = calcularTotalFisico();

    if (!confirm(`El total contado es S/ ${totalFisico.toFixed(2)}. ¿Confirmar cierre?`)) return;

    // Build desglose map if needed, but simplified just sending total for now? 
    // Controller expects { desglose, saldoFinalReal }
    // Let's create dummy desglose obj just in case
    const desglose = {};
    document.querySelectorAll('.bill-input').forEach(inp => {
        if (inp.value > 0) desglose[inp.dataset.val] = parseInt(inp.value);
    });

    try {
        const res = await fetch('/api/caja/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldoFinalReal: totalFisico, desglose })
        });
        const data = await res.json();

        if (data.success) {
            mostrarReporte(data.estadisticas);
        } else {
            alert(data.message);
        }
    } catch (e) { console.error(e); }
}

function mostrarReporte(stats) {
    mostrarVista('viewReport');
    const div = document.getElementById('reportContent');
    const diff = stats.diferencia;
    const balanced = Math.abs(diff) < 0.05;

    div.innerHTML = `
        <div class="result-box ${balanced ? 'balanced' : 'mismatch'}">
            <h2>${balanced ? 'CAJA CUADRADA' : 'DESCUADRE DETECTADO'}</h2>
            <p style="font-size:1.5em; margin:0;">${balanced ? 'Todo correcto' : ('Diferencia: S/ ' + diff.toFixed(2))}</p>
        </div>
        <div style="margin-top:20px;">
            <p>Saldo Inicial: S/ ${stats.saldoInicial.toFixed(2)}</p>
            <p>Ingresos: S/ ${stats.ingresos.toFixed(2)}</p>
            <p>Egresos: S/ ${stats.egresos.toFixed(2)}</p>
            <hr>
            <p><strong>Teórico: S/ ${stats.saldoTeorico.toFixed(2)}</strong></p>
            <p><strong>Real (Contado): S/ ${stats.saldoReal.toFixed(2)}</strong></p>
        </div>
    `;
}

function mostrarVista(id) {
    ['viewClosed', 'viewOpen', 'viewClosing', 'viewReport'].forEach(v => {
        document.getElementById(v).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}
