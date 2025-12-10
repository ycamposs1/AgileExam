document.addEventListener("DOMContentLoaded", () => {
    cargarComprobantes();

    // Filtro de búsqueda
    const buscarInput = document.getElementById("buscarInput");
    buscarInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        filtrarComprobantes(query);
    });
});

let allComprobantes = [];

async function cargarComprobantes() {
    try {
        const res = await fetch('/api/comprobantes'); // 🔸 URL corregida
        const data = await res.json();

        if (data.success) {
            allComprobantes = data.comprobantes;
            renderizarComprobantes(allComprobantes);
        } else {
            console.error(data.message);
            document.getElementById("listaComprobantes").innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${data.message || 'Error al cargar.'}</td></tr>`;
        }
    } catch (error) {
        console.error("Error cargando comprobantes:", error);
        document.getElementById("listaComprobantes").innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error de conexión. Intente recargar.</td></tr>`;
    }
}

function renderizarComprobantes(lista) {
    const tbody = document.getElementById("listaComprobantes");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No se encontraron comprobantes.</td></tr>`;
        return;
    }

    lista.forEach(c => {
        const tr = document.createElement("tr");

        // Formato fecha: 2025-12-10 14:30:00 -> 10/12/2025 14:30
        const fechaObj = new Date(c.fecha);
        const fechaStr = isNaN(fechaObj) ? c.fecha : fechaObj.toLocaleString();

        // Estilo según tipo
        let claseTipo = "";
        if (c.tipo.includes("Pago")) claseTipo = "badge-payment";
        if (c.tipo.includes("Cancelación")) claseTipo = "badge-cancel";

        tr.innerHTML = `
            <td><strong>#${c.id}</strong></td>
            <td>${fechaStr}</td>
            <td>${c.nombre_cliente || 'Desconocido'}</td>
            <td><span class="badge ${claseTipo}">${c.tipo}</span></td>
            <td>${c.descripcion || '-'}</td>
            <td style="font-weight:bold; color:#2c3e50;">S/ ${parseFloat(c.monto).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarComprobantes(query) {
    const filtrados = allComprobantes.filter(c =>
        c.id.toString().includes(query) ||
        (c.nombre_cliente && c.nombre_cliente.toLowerCase().includes(query)) ||
        (c.monto && c.monto.toString().includes(query))
    );
    renderizarComprobantes(filtrados);
}
