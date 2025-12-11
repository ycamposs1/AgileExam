const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log("⚠️ INICIANDO RESET DEL SISTEMA...");

db.serialize(() => {
    // 1. Limpiar Tablas Transaccionales
    db.run("DELETE FROM clientes");
    db.run("DELETE FROM prestamos");
    db.run("DELETE FROM actividad");
    db.run("DELETE FROM caja_sesiones");
    db.run("DELETE FROM caja_movimientos");

    // Resetear Auto-Increment (SQLITE Sequence)
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('clientes', 'prestamos', 'actividad', 'caja_sesiones', 'caja_movimientos')");

    console.log("✅ Tablas limpiadas.");

    // 2. Resetear Fondos a 10,000
    db.run("DELETE FROM fondos");
    db.run("INSERT INTO fondos (monto_total) VALUES (10000.00)");

    console.log("✅ Fondos reiniciados a S/ 10,000.00.");
});

db.close(() => {
    console.log("🏁 SISTEMA RESETEADO CORRECTAMENTE.");
});
