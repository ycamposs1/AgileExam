async function cargarSimulacion() {
    const tbody = document.getElementById("tablaMora");
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando...</td></tr>';

    try {
        const res = await fetch('/api/mora');
        const response = await res.json();

        if (!response.success) {
            alert("Error cargando simulación: " + response.message);
            return;
        }

        const data = response.data;
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay préstamos activos para simular.</td></tr>';
            return;
        }

        data.forEach(item => {
            const warningStyle = item.isWarning ? 'background-color: #fff3cd;' : '';
            const row = `
        <tr style="${warningStyle}">
          <td>
            <strong>${item.nombre}</strong><br>
            <small style="color:#666;">${item.dni}</small>
          </td>
          <td class="money">S/ ${item.deudaActual}</td>
          <td style="text-align:center;">${item.plazoRestanteActual} meses</td>
          <td style="text-align:center; font-weight:bold; color:orange;">${item.mesesAtraso}</td>
          <td style="text-align:center; font-weight:bold; color:#d9534f;">${item.plazoSimulado} meses</td>
          <td class="money" style="color:#d9534f;">+ S/ ${item.moraGenerada}</td>
          <td class="money" style="font-weight:bold;">S/ ${item.nuevaCuotaMensual}</td>
          <td class="money" style="font-weight:bold; color:#d9534f;">S/ ${item.nuevaDeudaTotal}</td>
        </tr>
      `;
            tbody.innerHTML += row;
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error de conexión.</td></tr>';
    }
}

// Cargar al inicio
document.addEventListener("DOMContentLoaded", cargarSimulacion);
