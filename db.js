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
});

// Exportar conexión
module.exports = db;
