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
    const dni = "99991111"; // Unique debug DNI
    const tasas = JSON.stringify([{ tipo: "TEA", valor: 20 }]);

    console.log(`1. Creating Client DNI=${dni}...`);
    const createRes = await request('POST', '/api/clientes', JSON.stringify({
        dni, email: "debug@example.com", nombre: "Debug User", nombres: "Debug", apellido_paterno: "User",
        apellido_materno: "Test", departamento: "Lima", direccion: "Calle Debug",
        monto: 1000, plazo: 12, tcea_aplicada: 0.20, tasas_detalle: tasas, tipo_tasa: "MULTIPLE",
        fecha_inicio: "2024-01-01", fecha_fin: "2025-01-01", tipo: "natural"
    }));

    console.log("Create Response:", createRes);

    if (!createRes.success) {
        console.error("Creation failed!");
        process.exit(1);
    }

    console.log(`2. Fetching Client DNI=${dni}...`);
    const getRes = await request('GET', `/api/clientes/${dni}`);
    console.log("Get Response:", getRes);

    if (getRes.success && getRes.cliente) {
        console.log("SUCCESS: Client found.");
        console.log(`Saldo Pendiente: ${getRes.cliente.saldo_pendiente}`);
    } else {
        console.error("FAIL: Client not found.");
    }
}

run();
