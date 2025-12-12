const TCEA = 0.50; // 50%
const MONTO = 1000;
const PLAZO = 6;
const MORA_RATE = 0.01;

function calcularTEM(tcea) {
    return Math.pow(1 + tcea, 1 / 12) - 1;
}

function calcularCuota(saldo, tem, n) {
    if (n === 0) return 0;
    if (tem === 0) return saldo / n;
    return saldo * (tem * Math.pow(1 + tem, n)) / (Math.pow(1 + tem, n) - 1);
}

function formatear(num) {
    return num.toFixed(2);
}

/**
 * Simula el cronograma considerando qué meses se pagan y cuáles no.
 * @param {Array<boolean>} patronPago Array de booleans. true = pagó a tiempo, false = no pagó (mora).
 * El índice 0 corresponde al Mes 1.
 */
function simularCronograma(patronPago) {
    let saldo = MONTO;
    let tem = calcularTEM(TCEA);
    let n = PLAZO;
    let cuotaActual = calcularCuota(saldo, tem, n);

    console.log(`\n=== SIMULACIÓN: [${patronPago.map(p => p ? "PAGÓ" : "NO PAGÓ").join(", ")}] ===`);
    console.log(`TEM: ${(tem * 100).toFixed(4)}% | Cuota Inicial: ${formatear(cuotaActual)}`);
    console.log("Mes | Saldo Ini | Interés | Mora | Total Cargo | Pago | Nuevo Saldo | Cuota Futura");
    console.log("-".repeat(90));

    for (let mes = 1; mes <= PLAZO; mes++) {
        const pagoATiempo = patronPago[mes - 1]; // true/false
        const interes = saldo * tem;
        let mora = 0;
        let amortizacion = 0;
        let pagoRealizado = 0;
        let totalCargo = interes;

        if (pagoATiempo) {
            // Cliente paga la cuota pactada
            // Nota: Si veníamos de un recálculo, la cuotaActual ya incluye el ajuste.
            pagoRealizado = cuotaActual; // Asumimos que paga lo que dice su cronograma vigente
            amortizacion = pagoRealizado - interes;
            saldo -= amortizacion;
            // Si es el último mes, ajustar redondeo
            if (mes === PLAZO && Math.abs(saldo) < 1) saldo = 0;
        } else {
            // Cliente NO PAGA
            mora = saldo * MORA_RATE;
            totalCargo += mora;
            // El saldo CRECE
            saldo += (interes + mora); // Capitalizamos todo (Interés + Mora)

            // Recalculamos la cuota para los meses restantes
            // Meses restantes = Total - Mes Actual
            const mesesRestantes = PLAZO - mes;
            if (mesesRestantes > 0) {
                cuotaActual = calcularCuota(saldo, tem, mesesRestantes);
            } else {
                cuotaActual = saldo; // Si falla el último mes, debe todo
            }
        }

        console.log(`${mes.toString().padStart(3)} | ${formatear(saldo - (pagoATiempo ? -amortizacion : totalCargo)).padStart(9)} | ${formatear(interes).padStart(7)} | ${formatear(mora).padStart(4)} | ${formatear(totalCargo).padStart(11)} | ${formatear(pagoRealizado).padStart(4)} | ${formatear(saldo).padStart(11)} | ${formatear(cuotaActual).padStart(12)}`);
    }
}

// Escenario Base: Paga todo
simularCronograma([true, true, true, true, true, true]);

// Escenario 1: No paga Mes 1
simularCronograma([false, true, true, true, true, true]);

// Escenario 2: No paga Mes 1 y 2
simularCronograma([false, false, true, true, true, true]);

// Escenario 3: No paga Mes 1, 2 y 3
simularCronograma([false, false, false, true, true, true]);
