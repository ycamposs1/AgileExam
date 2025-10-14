// db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data.db');

// Crear tabla de administrador si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
  // Tabla de fondos disponibles (dinero total para préstamos)
db.run(`CREATE TABLE IF NOT EXISTS fondos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monto_total REAL DEFAULT 0
)`);

// Si no hay registro, inserta uno inicial (por ejemplo S/ 10,000)
db.get("SELECT COUNT(*) as count FROM fondos", (err, row) => {
  if (row.count === 0) {
    db.run("INSERT INTO fondos (monto_total) VALUES (?)", [10000]);
  }
});

});

// Exportar conexión
module.exports = db;
