const db = require('../db');

// ==============================
// 🔹 Listar clientes y préstamos
// ==============================
exports.listarClientes = (req, res) => {
  const query = `
    SELECT 
      c.dni,
      c.nombre,
      IFNULL(p.monto, 0) AS monto,
      IFNULL(p.fecha_inicio, '') AS fecha_inicio,
      IFNULL(p.fecha_fin, '') AS fecha_fin
    FROM clientes c
    LEFT JOIN prestamos p ON c.id = p.id_cliente
    ORDER BY c.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error al obtener clientes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener clientes" });
    }
    res.json({ success: true, clientes: rows });
  });
};

// ==============================
// 🔹 Crear cliente y préstamo
// ==============================
exports.crearCliente = (req, res) => {
  const { dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion, monto, fecha_inicio, fecha_fin } = req.body;

  if (!dni || !nombre || !monto)
    return res.json({ success: false, message: "Faltan datos obligatorios" });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      `INSERT INTO clientes (dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion],
      function (err) {
        if (err) {
          console.error("Error cliente:", err);
          db.run("ROLLBACK");
          return res.json({ success: false, message: "Error al registrar cliente" });
        }

        const idCliente = this.lastID;

        db.run(
          "INSERT INTO prestamos (id_cliente, monto, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)",
          [idCliente, monto, fecha_inicio, fecha_fin],
          function (err2) {
            if (err2) {
              console.error("Error préstamo:", err2);
              db.run("ROLLBACK");
              return res.json({ success: false, message: "Error al registrar préstamo" });
            }

            // Actualizar fondo total
            db.run("UPDATE fondos SET monto_total = monto_total - ? WHERE id = 1", [monto], (err3) => {
              if (err3) {
                console.error("Error fondo:", err3);
                db.run("ROLLBACK");
                return res.json({ success: false, message: "Error al actualizar fondo" });
              }

              db.run("COMMIT");
              res.json({ success: true, message: "Cliente y préstamo registrados correctamente" });
            });
          }
        );
      }
    );
  });
};

// ==============================
// 🔹 Eliminar cliente (y préstamo)
// ==============================
exports.eliminarCliente = (req, res) => {
  const dni = req.params.dni;
  if (!dni) return res.status(400).json({ success: false, message: "DNI requerido" });

  db.serialize(() => {
    db.get("SELECT id FROM clientes WHERE dni = ?", [dni], (err, cliente) => {
      if (err || !cliente) return res.status(404).json({ success: false, message: "Cliente no encontrado" });

      db.run("DELETE FROM prestamos WHERE id_cliente = ?", [cliente.id], (err2) => {
        if (err2) return res.status(500).json({ success: false, message: "Error al eliminar préstamo" });

        db.run("DELETE FROM clientes WHERE id = ?", [cliente.id], (err3) => {
          if (err3) return res.status(500).json({ success: false, message: "Error al eliminar cliente" });

          res.json({ success: true, message: "Cliente y préstamo eliminados correctamente" });
        });
      });
    });
  });
};
