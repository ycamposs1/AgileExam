const db = require('../db');

// =======================================================
// 🔹 LISTAR CLIENTES (con nombre, email y préstamo asociado)
// =======================================================
exports.obtenerClientes = (req, res) => {
  const query = `
    SELECT 
      c.dni,
      c.nombre,
      c.email,
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

// =======================================================
// 🔹 OBTENER DETALLE DE CLIENTE POR DNI
// =======================================================
exports.obtenerClientePorDni = (req, res) => {
  const { dni } = req.params;

  const query = `
    SELECT 
      c.*, 
      IFNULL(p.monto, 0) AS monto, 
      IFNULL(p.fecha_inicio, '') AS fecha_inicio, 
      IFNULL(p.fecha_fin, '') AS fecha_fin
    FROM clientes c
    LEFT JOIN prestamos p ON c.id = p.id_cliente
    WHERE c.dni = ?
  `;

  db.get(query, [dni], (err, row) => {
    if (err) {
      console.error("Error obteniendo detalle:", err);
      return res.status(500).json({ success: false, message: "Error al obtener detalle." });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Cliente no encontrado." });
    }

    res.json({ success: true, cliente: row });
  });
};

// =======================================================
// 🔹 CREAR CLIENTE Y PRÉSTAMO
// =======================================================
exports.crearCliente = (req, res) => {
  const {
    dni,
    email,
    nombre,
    nombres,
    apellido_paterno,
    apellido_materno,
    departamento,
    direccion,
    monto,
    plazo,
    fecha_inicio,
    fecha_fin
  } = req.body;

  // Validación de campos requeridos
  if (!dni || !nombre || !email || !monto || !fecha_inicio || !fecha_fin) {
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
        crearPrestamo(clienteExistente.id);
      } else {
        // Crear nuevo cliente con email
        const insertarCliente = `
          INSERT INTO clientes (dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion, email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          insertarCliente,
          [dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion, email],
          function (err) {
            if (err) {
              console.error("Error al insertar cliente:", err);
              return res.status(500).json({
                success: false,
                message: "Error al registrar cliente. Es posible que el DNI ya exista."
              });
            }
            crearPrestamo(this.lastID);
          }
        );
      }
    });
  });

  // ------------------------------
  // 🧩 Función auxiliar: Crear préstamo y cronograma
  // ------------------------------
  function crearPrestamo(idCliente) {
    const insertarPrestamo = `
      INSERT INTO prestamos (id_cliente, monto, fecha_inicio, fecha_fin, plazo)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(insertarPrestamo, [idCliente, monto, fecha_inicio, fecha_fin, plazo], function (err) {
      if (err) {
        console.error("Error préstamo:", err);
        return res.status(500).json({ success: false, message: "Error al registrar préstamo." });
      }

      // Actualizar fondo total
      db.run("UPDATE fondos SET monto_total = monto_total - ?", [monto], (err2) => {
        if (err2) {
          console.error("Error actualizando fondos:", err2);
          return res.status(500).json({ success: false, message: "Error al actualizar fondo." });
        }

        // ✅ Generar cronograma simple
        const pagos = generarCronograma(fecha_inicio, monto, plazo);
        console.table(pagos);

        res.json({
          success: true,
          message: "✅ Cliente registrado y préstamo asignado correctamente.",
          cronograma: pagos
        });
      });
    });
  }

  // ------------------------------
  // 🧮 Función auxiliar: Cronograma de pagos mensuales
  // ------------------------------
  function generarCronograma(fechaInicio, montoTotal, meses) {
    const pagos = [];
    const montoMensual = (montoTotal / meses).toFixed(2);
    let fecha = new Date(fechaInicio);

    for (let i = 1; i <= meses; i++) {
      fecha.setMonth(fecha.getMonth() + 1);
      pagos.push({
        nro_cuota: i,
        fecha_pago: fecha.toISOString().split('T')[0],
        monto: parseFloat(montoMensual)
      });
    }

    return pagos;
  }
};

// =======================================================
// 🔹 ELIMINAR CLIENTE Y SU PRÉSTAMO
// =======================================================
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
