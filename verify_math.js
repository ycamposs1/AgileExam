function generarCronograma(montoTotal, meses, tcea) {
    const i = Math.pow(1 + parseFloat(tcea), 1 / 12) - 1; // tasa mensual
    const cuota = montoTotal * (i / (1 - Math.pow(1 + i, -meses))); // fórmula de anualidades
    console.log(`Monto: ${montoTotal}, Meses: ${meses}, TCEA: ${tcea}`);
    console.log(`Tasa Mensual (i): ${i}`);
    console.log(`Cuota: ${cuota}`);
    return cuota;
}

generarCronograma(1000, 12, 0.50);
