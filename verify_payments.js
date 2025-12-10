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
    const dni = "88880005";

    // 1. Create client
    console.log("Creating client...");
    await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "payTest2@example.com", nombre: "Pay Test 2", nombres: "Pay", apellido_paterno: "Test",
        apellido_materno: "User", departamento: "Lima", direccion: "Calle X",
        monto: 1000, plazo: 12, tcea_aplicada: 0.20, tipo_tasa: "TEA",
        fecha_inicio: "2025-01-01", fecha_fin: "2025-12-31", tipo: "natural"
    }));

    // 2. Initial check
    let res = await request('GET', `/api/clientes/${dni}`);
    let saldo = res.cliente.saldo_pendiente !== undefined ? res.cliente.saldo_pendiente : res.cliente.monto;
    console.log(`Initial Debt: ${saldo} (Expected ~1000)`);

    // 3. Pay 100 (No Mora)
    console.log("Paying 100 (No Mora)...");
    res = await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: 100, aplicaMora: false }));
    console.log("New Balance:", res.nuevoSaldo);

    if (Math.abs(res.nuevoSaldo - 900) < 0.1) console.log("PASS: Payment check");
    else console.log("FAIL: Payment check");

    // 4. Pay 100 (With Multiple Rates: Mora 1% + Admin 0.5%)
    // Current Balance: 900.
    // Mora 1%: 9.00
    // Admin 0.5%: 4.50
    // Total Debt: 900 + 9 + 4.5 = 913.5
    // Payment: 100
    // New Balance: 813.5
    console.log("Paying 100 (With Multiple Rates)...");
    const tasas = [{ tipo: "Mora", valor: 1.0 }, { tipo: "Administrativo", valor: 0.5 }];
    res = await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: 100, tasas }));
    console.log("New Balance:", res.nuevoSaldo);

    if (Math.abs(res.nuevoSaldo - 813.5) < 0.1) console.log("PASS: Multiple Rates check");
    else console.log(`FAIL: Multiple Rates check (Expected 813.5, got ${res.nuevoSaldo})`);

    process.exit(0);
}

run();
