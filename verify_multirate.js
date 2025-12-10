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
    const dni = "77770025";

    // 1. Create client MULTI-RATE
    console.log("Creating Multi-Rate Client...");
    // TEA 10% + TCEA 5% = 15% (0.15)
    const tasas_detalle = JSON.stringify([
        { tipo: "TEA", valor: 10 },
        { tipo: "TCEA", valor: 5 }
    ]);

    const createRes = await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "multi@example.com", nombre: "Multi", nombres: "User", apellido_paterno: "Rate",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle Y",
        monto: 1000, plazo: 12,
        tcea_aplicada: 0.15,
        tasas_detalle: tasas_detalle,
        tipo_tasa: "MULTIPLE",
        fecha_inicio: "2025-01-01", fecha_fin: "2025-12-31", tipo: "natural"
    }));

    console.log("Create Result:", createRes.message);

    // 2. Initial check
    let res = await request('GET', `/api/clientes/${dni}`);
    let saldo = res.cliente.saldo_pendiente !== undefined ? res.cliente.saldo_pendiente : res.cliente.monto;
    console.log(`Initial Debt: ${saldo}`);

    // 3. Pay Partial (Simulating Button "Pago Cuota" - say 100)
    console.log("Paying Quote (100)...");
    res = await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: 100 }));
    console.log("New Balance:", res.nuevoSaldo);

    if (Math.abs(res.nuevoSaldo - 900) < 0.1) console.log("PASS: Partial pay");
    else console.log("FAIL: Partial pay");

    // 4. Pay Total (Liquidate)
    const debtToPay = res.nuevoSaldo;
    console.log(`Liquidating Debt (${debtToPay})...`);
    res = await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: debtToPay }));
    console.log("New Balance:", res.nuevoSaldo);

    if (Math.abs(res.nuevoSaldo - 0) < 0.1) console.log("PASS: Liquidation");
    else console.log(`FAIL: Liquidation (Expected 0, got ${res.nuevoSaldo})`);

    // 5. Verify Client is removed from list (filtered out)
    console.log("Checking if paid client is removed from list...");
    const listRes = await request('GET', '/api/clientes');
    const found = listRes.clientes.find(c => c.dni === dni);

    if (!found) console.log("PASS: Client filtered from list");
    else console.log("FAIL: Client still in list");

    process.exit(0);
}

run();
