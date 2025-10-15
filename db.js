// db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data.db');

// Crear tabla de administrador si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT,
    movil TEXT
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

// Tabla de clientes
db.run(`CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT UNIQUE,
  nombre TEXT,
  fecha_nacimiento TEXT,
  direccion TEXT,
  departamento TEXT,
  provincia TEXT,
  distrito TEXT
)`);

// Tabla de préstamos (relacional)
db.run(`CREATE TABLE IF NOT EXISTS prestamos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER,
  monto REAL,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes (id)
)`);

db.run(`
  CREATE TABLE IF NOT EXISTS actividad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    id_prestamo INTEGER,
    dni_cliente TEXT,
    tipo TEXT,           -- "Préstamo otorgado" | "Pago completado"
    monto REAL,
    descripcion TEXT
  )
`);




});

// Exportar conexión
module.exports = db;
