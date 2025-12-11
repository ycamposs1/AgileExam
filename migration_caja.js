const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🛠️ Iniciando migración de Caja...");

    // Tabla de Sesiones de Caja
    db.run(`CREATE TABLE IF NOT EXISTS caja_sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_apertura TEXT NOT NULL,
        fecha_cierre TEXT,
        saldo_inicial REAL DEFAULT 0,
        saldo_final_teorico REAL,
        saldo_final_real REAL,
        estado TEXT DEFAULT 'ABIERTA', -- ABIERTA, CERRADA
        usuario_id INTEGER
    )`);
    console.log("✅ Tabla 'caja_sesiones' creada/verificada.");

    // Tabla de Movimientos de Caja
    db.run(`CREATE TABLE IF NOT EXISTS caja_movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id INTEGER,
        tipo TEXT NOT NULL, -- INGRESO, EGRESO
        monto REAL NOT NULL,
        descripcion TEXT,
        fecha TEXT NOT NULL,
        referencia_id INTEGER, -- ID de Préstamo o Actividad relacionada
        FOREIGN KEY(sesion_id) REFERENCES caja_sesiones(id)
    )`);
    console.log("✅ Tabla 'caja_movimientos' creada/verificada.");
});

db.close(() => {
    console.log("🏁 Migración completada.");
});
