const db = require('../../db');

// CONFIG
const MORA_RATE = 0.01;

function calcularTEM(tcea) {
    return Math.pow(1 + tcea, 1 / 12) - 1;
}

function calcularCuota(saldo, tem, n) {
    if (n <= 0) return saldo; // Si no hay plazo, se debe todo
    if (tem === 0) return saldo / n;
    return saldo * (tem * Math.pow(1 + tem, n)) / (Math.pow(1 + tem, n) - 1);
}

function formatear(num) {
    return Number(num.toFixed(2));
}

// SIMULATE SCHEDULE
function simularCronograma(saldoInicial, tcea, plazoTotal, patronPago) {
    let saldo = saldoInicial;
    let tem = calcularTEM(tcea);
    let cuotaActual = calcularCuota(saldo, tem, plazoTotal);

    const cronograma = [];

    for (let mes = 1; mes <= plazoTotal; mes++) {
        const pagoATiempo = patronPago[mes - 1]; // true/false
        const interes = saldo * tem;
        let mora = 0;
        let amortizacion = 0;
        let pagoRealizado = 0;
        let totalCargo = interes;
        let isWarning = !pagoATiempo;

        if (pagoATiempo) {
            pagoRealizado = cuotaActual;
            amortizacion = pagoRealizado - interes;
            saldo -= amortizacion;
            if (mes === plazoTotal && Math.abs(saldo) < 1) saldo = 0;
        } else {
            // Formula User Verified:
            // 1. Saldo Insoluto = Saldo + Interes
            // 2. Mora = Saldo Insoluto * 1%
            mora = (saldo + interes) * MORA_RATE;
            totalCargo += mora;
            // Capitalize Interest + Mora
            saldo += (interes + mora);

            // Recalculate Future
            const mesesRestantes = plazoTotal - mes;
            if (mesesRestantes > 0) {
                cuotaActual = calcularCuota(saldo, tem, mesesRestantes);
            } else {
                cuotaActual = saldo;
            }
        }

        cronograma.push({
            mes,
            saldoInicial: formatear(saldo - (pagoATiempo ? -amortizacion : totalCargo)), // Reversing logic to get start balance
            interes: formatear(interes),
            mora: formatear(mora),
            totalCargo: formatear(totalCargo),
            pagoRealizado: formatear(pagoRealizado),
            nuevoSaldo: formatear(saldo),
            cuotaFutura: formatear(cuotaActual),
            estado: pagoATiempo ? "PAGADO" : "NO PAGADO"
        });
    }
    return cronograma;
}

exports.obtenerSimulacionMora = (req, res) => {
    // 1. Get active loans
    const sql = `
        SELECT c.dni, c.nombre, 
               p.monto, p.tcea_aplicada, p.plazo
        FROM clientes c
        JOIN prestamos p ON c.id = p.id_cliente
        WHERE (p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const resultados = rows.map(prestamo => {
            const tcea = prestamo.tcea_aplicada; // stored as decimal e.g. 0.50
            const monto = prestamo.monto;
            const plazo = prestamo.plazo;

            const scenarios = [];

            // Generate scenarios: From 1 missed month up to the total term (or a limit)
            for (let k = 1; k <= plazo; k++) {
                const patron = Array(plazo).fill(true);
                // Mark first k months as missed (false)
                for (let j = 0; j < k; j++) {
                    if (j < plazo) patron[j] = false;
                }

                scenarios.push({
                    nombre: `No paga primeros ${k} Meses`,
                    detalle: simularCronograma(monto, tcea, plazo, patron)
                });
            }

            return {
                cliente: prestamo.nombre,
                dni: prestamo.dni,
                monto: monto,
                plazo: plazo,
                scenarios: scenarios
            };
        });

        res.json({ success: true, data: resultados });
    });
};
