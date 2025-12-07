const db = require('./db');

db.serialize(() => {
  db.run("DELETE FROM clientes");
  db.run("DELETE FROM prestamos");
  db.run("DELETE FROM actividad");
  db.run("DELETE FROM fondos");
  db.run("VACUUM");
  console.log("✅ Base de datos limpiada correctamente.");
});
