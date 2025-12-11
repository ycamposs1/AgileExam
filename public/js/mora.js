async function cargarSimulacion() {
    const container = document.getElementById("moraContainer");
    container.innerHTML = '<p style="text-align:center;">Cargando...</p>';

    try {
        const res = await fetch('/api/mora');
        const response = await res.json();

        if (!response.success) {
            container.innerHTML = `<p style="color:red; text-align:center;">Error: ${response.message}</p>`;
            return;
        }

        const data = response.data;
        container.innerHTML = "";

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center;">No hay préstamos activos para simular.</p>';
            return;
        }

        // Group by DNI
        const grouped = {};
        data.forEach(item => {
            if (!grouped[item.dni]) {
                grouped[item.dni] = {
                    nombre: item.nombre,
                    dni: item.dni,
                    scenarios: []
                };
            }
            grouped[item.dni].scenarios.push(item);
        });

        // Render groups
        Object.values(grouped).forEach(client => {
            const details = document.createElement('details');

            // Summary Header
            details.innerHTML = `
                <summary>
                    <span>${client.nombre} <small>(${client.dni})</small></span>
                    <span style="font-size:0.8em; color:#666; margin-right:10px;">${client.scenarios.length} Escenarios</span>
                </summary>
                <div class="mora-content">
                    <table class="mini-table">
                        <thead>
                            <tr>
                                <th>Atraso</th>
                                <th>Deuda Actual</th>
                                <th>Rest. Actual</th>
                                <th>Rest. Simulado</th>
                                <th>Mora (1%)</th>
                                <th>Nueva Cuota</th>
                                <th>Nueva Deuda</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${client.scenarios.map(sc => `
                                <tr style="${sc.isWarning ? 'background-color:#fff3cd' : ''}">
                                    <td style="font-weight:bold; color:orange;">${sc.mesesAtraso} mes(es)</td>
                                    <td>S/ ${sc.deudaActual}</td>
                                    <td>${sc.plazoRestanteActual} meses</td>
                                    <td style="font-weight:bold; color:#d9534f;">${sc.plazoSimulado} meses</td>
                                    <td style="color:#d9534f;">+ S/ ${sc.moraGenerada}</td>
                                    <td style="font-weight:bold;">S/ ${sc.nuevaCuotaMensual}</td>
                                    <td style="font-weight:bold; color:#d9534f;">S/ ${sc.nuevaDeudaTotal}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(details);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red; text-align:center;">Error de conexión.</p>';
    }
}

// Cargar al inicio
document.addEventListener("DOMContentLoaded", cargarSimulacion);
