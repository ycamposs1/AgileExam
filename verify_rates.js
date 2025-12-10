const http = require('http');

function postRequest(data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/clientes',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

function getRequest() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/clientes', (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

async function run() {
    try {
        // 1. Create TEA Client
        const teaPayload = JSON.stringify({
            dni: "99990003",
            email: "test_tea3@example.com",
            nombre: "Test TEA",
            nombres: "Test",
            apellido_paterno: "TEA",
            apellido_materno: "User",
            departamento: "Lima",
            direccion: "Calle 123",
            monto: 1000,
            plazo: 12,
            // tipo_prestamo removed to test default
            tcea_aplicada: 0.20,
            tipo_tasa: "TEA",
            fecha_inicio: "2025-01-01",
            fecha_fin: "2025-12-31",
            tipo: "natural"
        });

        console.log("Creating TEA Client...");
        const res1 = await postRequest(teaPayload);
        console.log("Response 1:", res1);

        // 2. Create TREA Client
        const treaPayload = JSON.stringify({
            dni: "99990004",
            email: "test_trea4@example.com",
            nombre: "Test TREA",
            nombres: "Test",
            apellido_paterno: "TREA",
            apellido_materno: "User",
            departamento: "Lima",
            direccion: "Calle 123",
            monto: 2000,
            plazo: 12,
            // tipo_prestamo removed
            tcea_aplicada: 0.25,
            tipo_tasa: "TREA",
            fecha_inicio: "2025-01-01",
            fecha_fin: "2025-12-31",
            tipo: "natural"
        });

        console.log("Creating TREA Client...");
        const res2 = await postRequest(treaPayload);
        console.log("Response 2:", res2);

        // 3. Verify Lists
        console.log("Fetching list...");
        const list = await getRequest();

        const teaClient = list.clientes.find(c => c.dni === "99990003");
        const treaClient = list.clientes.find(c => c.dni === "99990004");

        console.log("TEA Client Check:", teaClient && teaClient.tipo_tasa === 'TEA' ? 'PASS' : 'FAIL', teaClient?.tipo_tasa);
        console.log("TREA Client Check:", treaClient && treaClient.tipo_tasa === 'TREA' ? 'PASS' : 'FAIL', treaClient?.tipo_tasa);

        if (teaClient && teaClient.tipo_tasa === 'TEA' && treaClient && treaClient.tipo_tasa === 'TREA') {
            console.log("ALL CHECKS PASSED");
            process.exit(0);
        } else {
            console.log("SOME CHECKS FAILED");
            process.exit(1);
        }

    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
