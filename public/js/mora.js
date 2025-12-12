async function cargarSimulacion() {
    const container = document.getElementById("moraContainer");
    container.innerHTML = '<p class="text-center">Cargando simulación...</p>';

    try {
        const res = await fetch('/api/mora');
        const response = await res.json();

        if (!response.success) {
            container.innerHTML = `<p class="alert alert-error">Error: ${response.message}</p>`;
            return;
        }

        const data = response.data;
        container.innerHTML = "";

        if (data.length === 0) {
            container.innerHTML = '<p class="text-center">No hay préstamos activos para simular.</p>';
            return;
        }

        data.forEach(client => {
            const clientSection = document.createElement('div');
            clientSection.className = 'card';
            clientSection.innerHTML = `<h3>${client.cliente} <small>(${client.dni})</small></h3>`;

            client.scenarios.forEach(scenario => {
                const details = document.createElement('details');
                details.innerHTML = `
                    <summary>
                        <span>${scenario.nombre}</span>
                    </summary>
                    <div class="mora-content">
                        <table class="mini-table">
                            <thead>
                                <tr>
                                    <th>Mes</th>
                                    <th>Saldo Ini</th>
                                    <th>Interés</th>
                                    <th>Mora (1%)</th>
                                    <th>Total Cargo</th>
                                    <th>Pago</th>
                                    <th>Nuevo Saldo</th>
                                    <th>Cuota</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scenario.detalle.map(row => `
                                    <tr style="${row.estado === 'NO PAGADO' ? 'background: #fff3cd;' : ''}">
                                        <td>${row.mes}</td>
                                        <td>${row.saldoInicial}</td>
                                        <td>${row.interes}</td>
                                        <td style="color:${row.mora > 0 ? 'red' : 'inherit'}">${row.mora}</td>
                                        <td>${row.totalCargo}</td>
                                        <td>${row.pagoRealizado}</td>
                                        <td>${row.nuevoSaldo}</td>
                                        <td>${row.cuotaFutura}</td>
                                        <td>${row.estado}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                clientSection.appendChild(details);
            });

            container.appendChild(clientSection);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="alert alert-error">Error de conexión.</p>';
    }
}

document.addEventListener("DOMContentLoaded", cargarSimulacion);
