const http = require('http');

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    const dni = "55" + Math.floor(Math.random() * 900000 + 100000); // Random unique DNI
    const tasas = JSON.stringify([{ tipo: "TEA", valor: 20 }]);

    // 1. Create Old Loan (12 months)
    console.log("1. Creating Old Loan (12 months)...");
    await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "sched-reloan@example.com", nombre: "Schedule User", nombres: "Sched", apellido_paterno: "User",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle X",
        monto: 1000, plazo: 12, tcea_aplicada: 0.20, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2024-01-01", fecha_fin: "2025-01-01", tipo: "natural"
    }));

    // 2. Pay it off
    console.log("2. Paying off Old Loan...");
    const clientRes = await request('GET', `/api/clientes/${dni}`);
    if (!clientRes.cliente) {
        console.error("FAIL: Could not fetch client to pay off.", clientRes);
        process.exit(1);
    }
    const deuda = clientRes.cliente.saldo_pendiente !== undefined
        ? clientRes.cliente.saldo_pendiente
        : clientRes.cliente.monto;

    console.log(`Paying off: S/ ${deuda}`);
    const payRes = await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: deuda }));
    if (!payRes.success) {
        console.error("FAIL: Payment failed.", payRes);
        process.exit(1);
    }
    console.log("Payment successful.");

    // 3. Create New Loan (6 months)
    console.log("3. Creating New Loan (6 months)...");
    const create2Res = await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "sched-reloan@example.com", nombre: "Schedule User", nombres: "Sched", apellido_paterno: "User",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle X",
        monto: 2000, plazo: 6, tcea_aplicada: 0.20, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2025-02-01", fecha_fin: "2025-08-01", tipo: "natural"
    }));

    if (!create2Res.success) {
        console.error("FAIL: Second creation failed (likely duplicate loan blocked).", create2Res);
        process.exit(1);
    }
    console.log("Second creation successful.");

    // 4. Check Cronograma
    console.log("4. Fetching Schedule...");
    const cronoRes = await request('GET', `/api/clientes/${dni}/cronograma`);

    if (!cronoRes.success) {
        console.log("FAIL: Failed to fetch cronograma", cronoRes);
        process.exit(1);
    }

    console.log(`Cronograma Entries: ${cronoRes.cronograma.length}`);

    if (cronoRes.cronograma.length === 6) {
        console.log("PASS: Cronograma has 6 entries (Correctly ignored the old 12-month loan)");
    } else {
        console.log(`FAIL: Cronograma has ${cronoRes.cronograma.length} entries (Likely fetched the old loan)`);
    }

    process.exit(0);
}

run();
