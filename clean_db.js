const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🧹 Limpiando base de datos...");

    db.run("DELETE FROM clientes");
    console.log("✅ Clientes eliminados.");

    db.run("DELETE FROM prestamos");
    console.log("✅ Préstamos eliminados.");

    db.run("DELETE FROM actividad");
    console.log("✅ Actividad eliminada.");

    db.run("DELETE FROM fondos");
    console.log("✅ Fondos eliminados.");

    // Reset IDs
    db.run("DELETE FROM sqlite_sequence");
    console.log("✅ IDs reseteados.");

    // Init Funds
    db.run("INSERT INTO fondos (monto_total) VALUES (10000.00)", (err) => {
        if (err) console.error("❌ Error insertando fondos:", err);
        else console.log("💰 Fondos inicializados a S/ 10,000.00");
    });
});

db.close(() => {
    console.log("🏁 Limpieza completada.");
});
