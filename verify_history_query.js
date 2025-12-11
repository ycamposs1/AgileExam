const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

const dni = '73095929';

const query = `SELECT fecha, tipo, monto, descripcion FROM actividad WHERE dni_cliente = ? ORDER BY id DESC LIMIT 10`;

db.all(query, [dni], (err, rows) => {
    if (err) {
        console.error("Error:", err);
    } else {
        console.log("Rows found:", rows.length);
        console.log(JSON.stringify(rows, null, 2));
    }
});
