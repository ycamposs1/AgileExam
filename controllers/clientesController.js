const db = require('../db');

// listar a los clientes con su respectivo prestamo
exports.obtenerClientes = (req, res) => {
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

// 🔹 Crear cliente y préstamo
exports.crearCliente = (req, res) => {
  const {
    dni,
    nombre,
    nombres,
    apellido_paterno,
    apellido_materno,
    departamento,
    direccion,
    monto,
    fecha_inicio,
    fecha_fin
  } = req.body;

  // Validación básica
  if (!dni || !nombre || !monto || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({
      success: false,
      message: "Faltan campos obligatorios."
    });
  }

  // Verificar si el cliente ya tiene un préstamo activo
  const verificarPrestamo = `
    SELECT p.id FROM prestamos p
    JOIN clientes c ON p.id_cliente = c.id
    WHERE c.dni = ?;
  `;

  db.get(verificarPrestamo, [dni], (err, existingLoan) => {
    if (err) {
      console.error("Error verificando préstamo:", err);
      return res.status(500).json({ success: false, message: "Error verificando préstamo." });
    }

    if (existingLoan) {
      return res.status(400).json({
        success: false,
        message: "❌ No se puede otorgar un nuevo préstamo: el cliente ya tiene una deuda pendiente."
      });
    }

    // Verificar si el cliente ya existe
    db.get("SELECT id FROM clientes WHERE dni = ?", [dni], (err, clienteExistente) => {
      if (err) {
        console.error("Error verificando cliente:", err);
        return res.status(500).json({ success: false, message: "Error al verificar cliente." });
      }

      if (clienteExistente) {
        // Cliente existe → crear préstamo directamente
        crearPrestamo(clienteExistente.id);
      } else {
        // Crear cliente nuevo
        const insertarCliente = `
          INSERT INTO clientes (dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          insertarCliente,
          [dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion],
          function (err) {
            if (err) {
              console.error("Error cliente:", err);
              return res.status(500).json({
                success: false,
                message: "Error al registrar cliente. Es posible que el DNI ya exista."
              });
            }
            crearPrestamo(this.lastID); // ✅ Usamos el ID recién insertado
          }
        );
      }
    });
  });

  // ---------------------
  // 🧩 Función auxiliar para crear préstamo y actualizar fondos
  // ---------------------
  function crearPrestamo(idCliente) {
    const insertarPrestamo = `
      INSERT INTO prestamos (id_cliente, monto, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?)
    `;
    db.run(insertarPrestamo, [idCliente, monto, fecha_inicio, fecha_fin], function (err) {
      if (err) {
        console.error("Error préstamo:", err);
        return res.status(500).json({ success: false, message: "Error al registrar préstamo." });
      }

      // Actualizar fondo total
      db.run("UPDATE fondos SET monto_total = monto_total - ?", [monto], function (err2) {
        if (err2) {
          console.error("Error actualizando fondos:", err2);
          return res.status(500).json({ success: false, message: "Error al actualizar fondo." });
        }

        res.json({
          success: true,
          message: "✅ Cliente registrado y préstamo asignado correctamente."
        });
      });
    });
  }
};



// 🔹 Eliminar cliente (y préstamo)
exports.eliminarCliente = (req, res) => {
  const { dni } = req.params;

  if (!dni)
    return res.status(400).json({ success: false, message: "Debe especificar el DNI" });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get("SELECT id FROM clientes WHERE dni = ?", [dni], (err, cliente) => {
      if (err || !cliente) {
        db.run("ROLLBACK");
        return res.json({ success: false, message: "Cliente no encontrado" });
      }

      db.run("DELETE FROM prestamos WHERE id_cliente = ?", [cliente.id], (err2) => {
        if (err2) {
          db.run("ROLLBACK");
          return res.json({ success: false, message: "Error al eliminar préstamo" });
        }

        db.run("DELETE FROM clientes WHERE id = ?", [cliente.id], (err3) => {
          if (err3) {
            db.run("ROLLBACK");
            return res.json({ success: false, message: "Error al eliminar cliente" });
          }

          db.run("COMMIT");
          res.json({ success: true, message: "✅ Cliente eliminado correctamente." });
        });
      });
    });
  });
};
