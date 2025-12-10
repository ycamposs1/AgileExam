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
    const dni = "99990030";

    // 1. Create client (Loan 1)
    console.log("1. Creating Client (Loan 1)...");
    const tasas = JSON.stringify([{ tipo: "TEA", valor: 10 }]);

    await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "reloan@example.com", nombre: "Reloan User", nombres: "Re", apellido_paterno: "Loan",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle Z",
        monto: 1000, plazo: 12, tcea_aplicada: 0.10, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2025-01-01", fecha_fin: "2025-12-31", tipo: "natural"
    }));

    // 2. Try duplicate immediate
    console.log("2. Attempting duplicate loan (should fail)...");
    const failRes = await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "reloan@example.com", nombre: "Reloan User", nombres: "Re", apellido_paterno: "Loan",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle Z",
        monto: 500, plazo: 6, tcea_aplicada: 0.10, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2025-06-01", fecha_fin: "2025-12-31", tipo: "natural"
    }));

    if (failRes.success === false && failRes.message.includes("ya tiene una deuda")) {
        console.log("PASS: Blocked active debt re-loan.");
    } else {
        console.log("FAIL: Did not block active debt re-loan.", failRes);
    }

    // 3. Pay off Loan 1
    console.log("3. Paying off Loan 1...");
    // Get current debt
    const clientRes = await request('GET', `/api/clientes/${dni}`);
    const deuda = clientRes.cliente.saldo_pendiente !== undefined ? clientRes.cliente.saldo_pendiente : clientRes.cliente.monto;

    await request('POST', `/api/clientes/${dni}/pago`, JSON.stringify({ montoPago: deuda }));
    console.log("Loan 1 Paid.");

    // 4. Try duplicate again (should success)
    console.log("4. Attempting new loan after payment (should pass)...");
    const successRes = await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "reloan@example.com", nombre: "Reloan User", nombres: "Re", apellido_paterno: "Loan",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle Z",
        monto: 2000, plazo: 24, tcea_aplicada: 0.10, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2025-02-01", fecha_fin: "2027-02-01", tipo: "natural"
    }));

    if (successRes.success) {
        console.log("PASS: Allowed new loan after payment.");
    } else {
        console.log("FAIL: Blocked new loan after payment.", successRes);
    }

    // 5. Verify Detail View shows the NEW loan (not the old 0 balance one)
    console.log("5. Verifying Detail View for Re-Loaned Client...");
    const newDetail = await request('GET', `/api/clientes/${dni}`);
    const saldoActual = newDetail.cliente.saldo_pendiente !== undefined ? newDetail.cliente.saldo_pendiente : newDetail.cliente.monto;

    if (saldoActual > 0.01) {
        console.log(`PASS: Detail view shows active debt: ${saldoActual}`);
    } else {
        console.log(`FAIL: Detail view shows 0 debt (probably fetching old loan). Saldo: ${saldoActual}`);
    }

    process.exit(0);
}

run();
