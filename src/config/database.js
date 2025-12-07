const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajustamos la ruta para que apunte a data.db en la raíz del proyecto
// __dirname ahora es src/config, así que subimos dos niveles
const dbPath = path.resolve(__dirname, '../../data.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con la base de datos:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
    }
});

module.exports = db;
