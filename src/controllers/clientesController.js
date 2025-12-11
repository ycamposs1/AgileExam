const db = require('../config/database');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// =======================================================
// 🔹 CONFIGURACIÓN DE TRANSPORTADOR DE CORREO
// =======================================================
console.log("🔑 SENDGRID_API_KEY (inicio):", process.env.SENDGRID_API_KEY?.slice(0, 10) || "No definida");


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


// =======================================================
// 🔹 LISTAR CLIENTES (con detalles financieros)
// =======================================================
exports.obtenerClientes = (req, res) => {
  const query = `
    SELECT 
      c.dni,
      c.nombre,
      c.email,
      c.tipo,
      c.origen,
      c.destino,
      IFNULL(p.tipo_prestamo, '') AS tipo_prestamo,
      IFNULL(p.tcea_aplicada, 0) AS tcea_aplicada,
      IFNULL(p.monto, 0) AS monto,
      IFNULL(p.plazo, 0) AS plazo,
      IFNULL(p.fecha_inicio, '') AS fecha_inicio,
      IFNULL(p.fecha_fin, '') AS fecha_fin,
      IFNULL(p.tipo_tasa, 'TEA') AS tipo_tasa,
      IFNULL(p.saldo_pendiente, p.monto) AS saldo_pendiente
    FROM clientes c
    LEFT JOIN prestamos p ON c.id = p.id_cliente
    WHERE (p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
    ORDER BY c.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error al obtener clientes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener clientes" });
    }

    const clientes = rows.map(c => {
      const i = Math.pow(1 + parseFloat(c.tcea_aplicada || 0), 1 / 12) - 1;
      const n = c.plazo || 0;
      const cuota = n > 0 && i > 0
        ? c.monto * (i / (1 - Math.pow(1 + i, -n)))
        : 0;
      const totalPagar = cuota * n;

      return {
        ...c,
        cuota_mensual: cuota.toFixed(2),
        total_pagar: totalPagar.toFixed(2)
      };
    });

    res.json({ success: true, clientes });
  });
};



// =======================================================
// 🔸 SIMULADOR DE MORA
// =======================================================
exports.obtenerSimulacionMora = (req, res) => {
  // 1. Fetch all clients with active loans
  const query = `
      SELECT 
        c.id, c.dni, c.nombre, 
        p.monto, p.plazo, p.tcea_aplicada, p.fecha_inicio,
        IFNULL(p.fondo_individual, 0) AS fondo_individual,
        IFNULL(p.saldo_pendiente, p.monto) AS saldo_pendiente_principal
      FROM clientes c
      JOIN prestamos p ON c.id = p.id_cliente
      WHERE (p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
    `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error en simulador:", err);
      return res.status(500).json({ success: false, message: "Error al obtener datos." });
    }

    const simulacion = [];

    rows.forEach(cliente => {
      // --- 1. Calculate Current Real Debt ---
      const i = Math.pow(1 + parseFloat(cliente.tcea_aplicada), 1 / 12) - 1;
      const cuotaRef = cliente.monto * (i / (1 - Math.pow(1 + i, -cliente.plazo)));
      const totalOriginalConInteres = cuotaRef * cliente.plazo;

      // Paid Capital = Original Principal - Current Principal Balance
      const saldoPrincipalActual = parseFloat(cliente.saldo_pendiente_principal);
      const totalPagadoCapital = parseFloat(cliente.monto) - saldoPrincipalActual;

      // DEUDA ACTUAL
      let deudaActual = totalOriginalConInteres - totalPagadoCapital - parseFloat(cliente.fondo_individual);
      if (deudaActual < 0) deudaActual = 0;

      // --- 2. Simulation Logic ---
      const fechaInicio = new Date(cliente.fecha_inicio);
      const hoy = new Date();
      let mesesTranscurridos = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
      if (hoy.getDate() < fechaInicio.getDate()) mesesTranscurridos--;

      let plazoRestanteActual = cliente.plazo - mesesTranscurridos;
      if (plazoRestanteActual < 1) plazoRestanteActual = 1;

      // 🔄 Generar escenarios: Desde 1 mes de atraso hasta el máximo posible (plazo restante - 1)
      // Si plazoRestante es 5, podemos atrasarnos 1, 2, 3, 4 meses. (Si nos atrasamos 5, el plazo es 0, explosión).
      // Limite: plazoRestante - 1. Si plazoRestante es 1, no podemos atrasarnos "1 mes" y seguir pagando, seria vencido total.

      const maxDelay = plazoRestanteActual - 1;

      // Si ya no hay margen (e.g. queda 1 mes), mostramos al menos 1 escenario de "Vencimiento Total" o similar?
      // El usuario pidio: 1 mes, 2 meses, etc y los que faltan.

      let scenariosToRun = maxDelay;
      if (scenariosToRun < 1) scenariosToRun = 0; // Solo mostramos warning o 1 escenario base

      if (scenariosToRun === 0) {
        // Caso borde: Queda 1 mes o menos. Simulamos vencimiento inmediato?
        // Dejamos vacio o mensaje especial.
        simulacion.push({
          dni: cliente.dni,
          nombre: cliente.nombre,
          deudaActual: deudaActual.toFixed(2),
          plazoRestanteActual: plazoRestanteActual,
          mesesAtraso: "N/A",
          plazoSimulado: 0,
          moraGenerada: "0.00",
          nuevaCuotaMensual: "Vencido",
          nuevaDeudaTotal: deudaActual.toFixed(2),
          isWarning: true
        });
      } else {
        for (let delay = 1; delay <= scenariosToRun; delay++) {
          let plazoSimulado = plazoRestanteActual - delay;

          // Mora Accumulada: 1% acumulativo simple o compuesto?
          // "Mora 1%" usually means monthly penalty.
          // Formula simple: 1% * DeudaActual * MesesAtraso
          const mora = deudaActual * 0.01 * delay;

          // Nueva Cuota
          const nuevaCuotaMensual = (deudaActual + mora) / plazoSimulado;
          const nuevaDeudaTotal = nuevaCuotaMensual * plazoSimulado;

          simulacion.push({
            dni: cliente.dni,
            nombre: cliente.nombre,
            deudaActual: deudaActual.toFixed(2),
            plazoRestanteActual: plazoRestanteActual,
            mesesAtraso: delay,
            plazoSimulado: plazoSimulado,
            moraGenerada: mora.toFixed(2),
            nuevaCuotaMensual: nuevaCuotaMensual.toFixed(2),
            nuevaDeudaTotal: nuevaDeudaTotal.toFixed(2),
            isWarning: delay > 1 // Highlight serious delays
          });
        }
      }
    });

    res.json({ success: true, data: simulacion });
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
      IFNULL(p.tipo_prestamo, '') AS tipo_prestamo,
      IFNULL(p.tcea_aplicada, 0) AS tcea_aplicada,
      IFNULL(p.monto, 0) AS monto, 
      IFNULL(p.plazo, 0) AS plazo,
      IFNULL(p.fecha_inicio, '') AS fecha_inicio, 
      IFNULL(p.fecha_fin, '') AS fecha_fin,
      IFNULL(p.tipo_tasa, 'TEA') AS tipo_tasa,
      p.tasas_detalle,
      p.tasas_detalle,
      IFNULL(p.fondo_individual, 0) AS fondo_individual,
      IFNULL(p.saldo_pendiente, p.monto) AS saldo_pendiente,
      p.id AS id_prestamo
    FROM clientes c
    LEFT JOIN prestamos p ON c.id = p.id_cliente
    WHERE c.dni = ? AND (p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
    ORDER BY p.id DESC
  `;

  db.get(query, [dni], (err, row) => {
    if (err) {
      console.error("Error obteniendo detalle:", err);
      return res.status(500).json({ success: false, message: "Error al obtener detalle." });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Cliente no encontrado." });
    }

    // 🔸 Obtener historial de pagos recientes (SOLO del préstamo actual)
    if (row.id_prestamo) {
      db.all(
        `SELECT fecha, tipo, monto, descripcion FROM actividad WHERE id_prestamo = ? ORDER BY id DESC LIMIT 10`,
        [row.id_prestamo],
        (err2, rowsActividad) => {
          if (err2) console.error("Error obteniendo historial:", err2);

          res.json({
            success: true,
            cliente: row,
            historial: rowsActividad || []
          });
        }
      );
    } else {
      // Si no hay préstamo activo, retornar vacío o historial general?
      // El usuario pidió solo cuotas que ya pagó (del prestamo activo asumimos).
      res.json({
        success: true,
        cliente: row,
        historial: []
      });
    }
  });
};



exports.crearCliente = (req, res) => {
  try {
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
      tipo_prestamo = "Personal", // Default
      tcea_aplicada,
      tasas_detalle, // New field, stringified JSON
      tipo_tasa,
      fecha_inicio,
      fecha_fin,
      tipo,        // natural | pep
      origen,      // solo si pep
      destino      // solo si pep
    } = req.body;

    // =========================
    // 🔸 Validación de campos
    // =========================
    if (!dni || !nombre || !email || !monto || !fecha_inicio || !fecha_fin || !tcea_aplicada || !tipo || !tipo_tasa) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios."
      });
    }

    if (tipo === 'pep' && (!origen || !destino)) {
      return res.status(400).json({
        success: false,
        message: "Debe especificar el origen y destino de los fondos para clientes PEP."
      });
    }

    // =========================
    // 🔸 Verificar préstamo activo
    // =========================
    db.get(
      `SELECT p.id FROM prestamos p
       JOIN clientes c ON p.id_cliente = c.id
       WHERE c.dni = ? AND (p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01);`,
      [dni],
      (err, existingLoan) => {
        if (err) {
          console.error("Error verificando préstamo:", err);
          return res.status(500).json({ success: false, message: "Error verificando préstamo." });
        }

        if (existingLoan) {
          return res.status(400).json({
            success: false,
            message: "❌ El cliente ya tiene una deuda pendiente."
          });
        }

        // =========================
        // 🔸 Verificar fondos disponibles
        // =========================
        db.get("SELECT monto_total FROM fondos LIMIT 1", [], (err, fondo) => {
          if (err) {
            console.error("Error obteniendo fondos:", err);
            return res.status(500).json({ success: false, message: "Error obteniendo fondos." });
          }

          if (!fondo || fondo.monto_total < monto) {
            return res.status(400).json({
              success: false,
              message: "❌ Fondos insuficientes para otorgar el préstamo."
            });
          }

          // =========================
          // 🔸 Verificar si cliente existe
          // =========================
          db.get("SELECT id FROM clientes WHERE dni = ?", [dni], (err, clienteExistente) => {
            if (err) {
              console.error("Error verificando cliente:", err);
              return res.status(500).json({ success: false, message: "Error al verificar cliente." });
            }

            db.run("BEGIN TRANSACTION", (errTx) => {
              if (errTx) {
                console.error("Error starting tx:", errTx);
                return res.status(500).json({ success: false, message: "Error iniciando transacción" });
              }

              if (clienteExistente) {
                // 🔸 ACTUALIZAR DATOS DEL CLIENTE (Email, Dirección, etc.)
                const updateCliente = `UPDATE clientes SET email = ?, nombre = ?, direccion = ?, departamento = ? WHERE id = ?`;
                db.run(updateCliente, [email, nombre, direccion, departamento, clienteExistente.id], (errUpdate) => {
                  if (errUpdate) console.error("Error actualizando cliente:", errUpdate);
                  insertarPrestamo(clienteExistente.id);
                });
              } else {
                // Crear nuevo cliente
                const insertarCliente = `
                INSERT INTO clientes 
                (dni, nombre, nombres, apellido_paterno, apellido_materno, departamento, direccion, email, tipo, origen, destino)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
                db.run(
                  insertarCliente,
                  [
                    dni,
                    nombre,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    departamento,
                    direccion,
                    email,
                    tipo || 'natural',
                    tipo === 'pep' ? origen : null,
                    tipo === 'pep' ? destino : null
                  ],
                  function (errInsertCliente) {
                    if (errInsertCliente) {
                      console.error("Error insertando cliente:", errInsertCliente);
                      db.run("ROLLBACK");
                      return res.status(500).json({ success: false, message: "Error al crear cliente." });
                    }
                    const newClientId = this.lastID;
                    insertarPrestamo(newClientId);
                  }
                );
              }
            }); // End transaction callback
          }); // End db.get callback

          function insertarPrestamo(idCliente) {
            // 🔸 Generar tasas_detalle filtrado (solo la seleccionada + ITF)
            let tasasFinales = [];
            try {
              const todasLasTasas = JSON.parse(tasas_detalle || '[]');
              // Si el usuario seleccionó una tasa específica (tipo_tasa), filtramos
              if (tipo_tasa) {
                // Mantener ITF (siempre) y la tasa seleccionada
                tasasFinales = todasLasTasas.filter(t => t.tipo === 'ITF' || t.tipo === tipo_tasa);
              } else {
                tasasFinales = todasLasTasas;
              }
            } catch (e) {
              console.error("Error filtrando tasas", e);
              tasasFinales = [];
            }
            const tasasDetalleStr = JSON.stringify(tasasFinales);

            const insertarPrestamo = `
              INSERT INTO prestamos 
              (id_cliente, monto, plazo, tipo_prestamo, saldo_pendiente, tcea_aplicada, tasas_detalle, tipo_tasa, fecha_inicio, fecha_fin)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(
              insertarPrestamo,
              [idCliente, monto, plazo, tipo_prestamo, monto, tcea_aplicada, tasasDetalleStr, tipo_tasa, fecha_inicio, fecha_fin],
              function (errInsertPrestamo) {
                if (errInsertPrestamo) {
                  console.error("Error insertando préstamo:", errInsertPrestamo);
                  db.run("ROLLBACK");
                  return res.status(500).json({ success: false, message: "Error al crear préstamo." });
                }

                const idPrestamo = this.lastID;
                console.log(`✅ Préstamo registrado (ID: ${idPrestamo})`);

                // 2. Registrar Actividad (Préstamo otorgado)
                const now = new Date();
                const fechaActual = now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0') + ' ' +
                  String(now.getHours()).padStart(2, '0') + ':' +
                  String(now.getMinutes()).padStart(2, '0') + ':' +
                  String(now.getSeconds()).padStart(2, '0');

                db.run(
                  `INSERT INTO actividad (fecha, id_prestamo, dni_cliente, tipo, monto, descripcion)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [fechaActual, idPrestamo, dni, "Préstamo otorgado", -monto, `Se otorgó un préstamo de S/ ${monto} al cliente ${nombre}`],
                  (errActividad) => {
                    if (errActividad) {
                      console.error("Error registrando actividad:", errActividad);
                      // No hacemos rollback critico por esto, pero idealmente si.
                    }

                    // 3. Descontar fondo global
                    db.run("UPDATE fondos SET monto_total = monto_total - ?", [monto], (errFondos) => {
                      if (errFondos) console.error("Error actualizando fondos:", errFondos);

                      // 4. Commit y Responder
                      db.run("COMMIT", (errCommit) => {
                        if (errCommit) {
                          return res.status(500).json({ success: false, message: "Error finalizando transacción." });
                        }
                        res.json({
                          success: true,
                          message: `✅ Cliente y préstamo registrados correctamente. El cronograma será enviado a ${email}.`
                        });
                      });
                    });
                  }
                );

                // ==============================
                // 📩 Enviar correo y PDF en fondo
                // ==============================
                (async () => {
                  try {
                    const pagos = generarCronograma(fecha_inicio, monto, plazo, tcea_aplicada);
                    const pdfPath = `./ cronograma_${dni}.pdf`;

                    await generarPDFCronograma({
                      nombre,
                      email,
                      tipo_prestamo,
                      monto,
                      plazo,
                      tcea_aplicada,
                      pagos
                    }, pdfPath);

                    await enviarCorreoConPDF(email, nombre, pdfPath, {
                      nombre,
                      email,
                      tipo_prestamo,
                      monto,
                      plazo,
                      tcea_aplicada,
                      pagos
                    });

                    console.log(`📤 Correo enviado correctamente a ${email}`);

                    // Eliminar PDF temporal
                    setTimeout(() => {
                      fs.unlink(pdfPath, err => {
                        if (err) console.error("⚠️ Error borrando PDF temporal:", err);
                      });
                    }, 10000);
                  } catch (mailErr) {
                    console.error("❌ Error generando o enviando correo:", mailErr);
                  }
                })();
              }
            );
          }
        });
      }
    );
  } catch (err) {
    console.error("❌ Error general en crearCliente:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};








// ------------------------------
// 🧮 Función auxiliar: Cronograma con TCEA
// ------------------------------
function generarCronograma(fechaInicio, montoTotal, meses, tcea) {
  const pagos = [];
  const i = Math.pow(1 + parseFloat(tcea), 1 / 12) - 1; // tasa mensual
  const cuota = montoTotal * (i / (1 - Math.pow(1 + i, -meses))); // fórmula de anualidades
  let fecha = new Date(fechaInicio);

  for (let n = 1; n <= meses; n++) {
    fecha.setMonth(fecha.getMonth() + 1);
    pagos.push({
      nro_cuota: n,
      fecha_pago: fecha.toISOString().split('T')[0],
      monto: parseFloat(cuota.toFixed(2))
    });
  }

  return pagos;
}

// =======================================================
// 🔹 REGISTRAR PAGO (Lógica simplificada)
// =======================================================
exports.registrarPago = (req, res) => {
  const { dni } = req.params;
  const { montoPago } = req.body; // Solo montoPago

  if (!montoPago || montoPago <= 0) {
    return res.status(400).json({ success: false, message: "Monto de pago inválido." });
  }

  console.log(`💰 Procesando pago para ${dni}: S/ ${montoPago}`);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get(
      `SELECT p.id, p.monto, p.saldo_pendiente, p.plazo, p.tcea_aplicada, p.fondo_individual, c.nombre, c.email
       FROM prestamos p
       JOIN clientes c ON p.id_cliente = c.id
       WHERE c.dni = ? AND(p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
       ORDER BY p.id DESC LIMIT 1`,
      [dni],
      (err, prestamo) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ success: false, message: "Error al buscar préstamo." });
        }
        if (!prestamo) {
          db.run("ROLLBACK");
          return res.status(404).json({ success: false, message: "No se encontró un préstamo activo." });
        }

        // 🧮 CALCULAR CUOTA MENSUAL REFERENCIAL
        // 🧮 VARIABLES DE CALCULO
        const i = Math.pow(1 + parseFloat(prestamo.tcea_aplicada), 1 / 12) - 1;
        const cuotaRef = prestamo.monto * (i / (1 - Math.pow(1 + i, -prestamo.plazo)));

        const totalOriginalConInteres = cuotaRef * prestamo.plazo;
        let saldoPrincipalActual = prestamo.saldo_pendiente !== null ? prestamo.saldo_pendiente : prestamo.monto;
        let totalPagadoCapital = prestamo.monto - saldoPrincipalActual;

        // Deuda Total "Real" (Principal + Intereses pendientes de amortizar)
        // Nota: Esta es la deuda BRUTA antes de restar el fondo individual.
        let deudaTotalBruta = totalOriginalConInteres - totalPagadoCapital;

        // Dinero disponible para "matar" la deuda hoy
        // (El pago que trae el usuario + lo que ya tiene guardado)
        let dineroDisponible = parseFloat(montoPago) + (parseFloat(prestamo.fondo_individual) || 0);

        let nuevoSaldo = saldoPrincipalActual;
        let tipoActividad = "";
        let descripcion = "";
        let destinoFondo = "";

        // � BRANCH A: LIQUIDACIÓN TOTAL (Si alcanza el dinero)
        // Usamos una pequeña tolerancia (0.50)
        if (dineroDisponible >= (deudaTotalBruta - 0.50)) {
          // ¡Paga todo!
          destinoFondo = "global";
          nuevoSaldo = 0;
          tipoActividad = "Pago Total de Deuda";
          descripcion = `Liquidación con Fondo - Pago: S/ ${montoPago} + Fondo: S/ ${prestamo.fondo_individual || 0}`;

          // 1. Vaciar fondo individual
          db.run("UPDATE prestamos SET fondo_individual = 0 WHERE id = ?", [prestamo.id], (err2) => {
            if (err2) console.error("Error reset fondo", err2);

            // 2. Cerrar préstamo (Saldo = 0)
            db.run("UPDATE prestamos SET saldo_pendiente = 0 WHERE id = ?", [prestamo.id], (err3) => {
              if (err3) {
                db.run("ROLLBACK");
                return res.status(500).json({ success: false, message: "Error liquidando." });
              }
              // 3. Registrar Transacción (Global funds gets everything? 
              // Actually, 'fondo_individual' was already in 'fondos' table physically? 
              // Wait, 'fondos' table tracks CASH ON HAND.
              // When money went to 'individual', did it go to 'fondos'?
              // Checking 'registrarPago' logic:
              // Branch Partial: afectarFondosGlobales = false. So NO.
              // Branch Global: afectarFondosGlobales = true. So YES.

              // So, the money in 'fondo_individual' is NOT in 'fondos'. 
              // Only the 'new' money (montoPago) should go to 'fondos' NOW?
              // OR, does 'fondo_individual' imply it was held aside?
              // User's previous code: `finalizarTransaccion(..., false)` for individual.
              // So money in 'individual' was NEVER added to 'fondos'.
              // implies we must add EVERYTHING (montoPago + fondo_individual) to 'fondos' now?
              // YES.

              // But 'finalizarTransaccion' logic takes 'montoPago' (from scope? No, it's not passed).
              // Function 'finalizarTransaccion' uses the global 'desc' and 'tipo' vars but what about amount?
              // I need to check 'finalizarTransaccion' implementation.
              // It likely uses 'montoPago' variable from closure.

              // IF I want to add `dineroDisponible` to system funds, I need to hack `montoPago`?
              // Or modify `finalizarTransaccion` to accept amount.

              // Let's modify `finalizarTransaccion` to take amount arg in this file scope if possible, 
              // OR just update `montoPago` to `dineroDisponible`.

              // Hack: Update `montoPago` variable? No, it's const.
              // I will rename `finalizarTransaccion` call to use `dineroDisponible`?
              // No, I need to see `finalizarTransaccion` definition below.

              finalizarTransaccion(tipoActividad, descripcion, true, dineroDisponible);
            });
          });

        }
        // 🔹 BRANCH B: PAGO PARCIAL (A Fondo Individual)
        else if (montoPago < (cuotaRef - 0.10)) {
          // ... Logica existente ...
          destinoFondo = "individual";
          const nuevoFondo = (parseFloat(prestamo.fondo_individual) || 0) + parseFloat(montoPago);
          db.run("UPDATE prestamos SET fondo_individual = ? WHERE id = ?", [nuevoFondo, prestamo.id], (err2) => {
            if (err2) {
              db.run("ROLLBACK");
              return res.status(500).json({ success: false, message: "Error actualizando fondo." });
            }
            finalizarTransaccion("Abono Individual", `Abono retenido (menor a cuota S/ ${cuotaRef.toFixed(2)})`, false, montoPago);
          });
        }
        // 🔹 BRANCH C: PAGO DE CUOTA (Directo a Capital)
        else {
          // ... Logica existente ...
          destinoFondo = "global";
          nuevoSaldo -= parseFloat(montoPago); // Standard reduction
          if (nuevoSaldo < 0.10) nuevoSaldo = 0;

          tipoActividad = (nuevoSaldo === 0) ? "Pago Total de Deuda" : "Pago de Cuota";
          descripcion = `${tipoActividad} - Pago recibido de S/ ${montoPago}`;

          db.run("UPDATE prestamos SET saldo_pendiente = ? WHERE id = ?", [nuevoSaldo, prestamo.id], (err2) => {
            if (err2) {
              db.run("ROLLBACK");
              return res.status(500).json({ success: false });
            }
            finalizarTransaccion(tipoActividad, descripcion, true, montoPago);
          });
        }

        // --- HELPER WRAPPER ---
        function finalizarTransaccion(tipo, desc, afectarFondos, montoReal) {
          const now = new Date();
          const fecha = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

          // Insert Actividad
          db.run(`INSERT INTO actividad (fecha, tipo, monto, descripcion, dni_cliente, id_cliente) VALUES (?, ?, ?, ?, ?, ?)`,
            [fecha, tipo, montoReal, desc, dni, prestamo.id_cliente],
            function (errAct) {
              if (errAct) console.error(errAct);
              // Pass ID back for receipt
              const lastID = this.lastID;

              if (afectarFondos) {
                db.run(`UPDATE fondos SET monto_total = monto_total + ?`, [montoReal], (errF) => {
                  if (errF) console.error(errF);
                  commitAndRespond(lastID);
                });
              } else {
                commitAndRespond(lastID);
              }
            }
          );
        }

        // --- HELPER WRAPPER ---
        function finalizarTransaccion(tipo, desc, afectarFondos, montoReal) {
          const now = new Date();
          const fecha = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

          // Insert Actividad
          db.run(`INSERT INTO actividad (fecha, id_prestamo, dni_cliente, tipo, monto, descripcion) VALUES (?, ?, ?, ?, ?, ?)`,
            [fecha, prestamo.id, dni, tipo, montoReal, desc],
            function (errAct) {
              if (errAct) {
                console.error("Error registro actividad:", errAct);
                db.run("ROLLBACK");
                return res.status(500).json({ success: false, message: "Error activity" });
              }

              const idActividad = this.lastID;

              if (afectarFondos) {
                db.run(`UPDATE fondos SET monto_total = monto_total + ?`, [montoReal], (errF) => {
                  if (errF) console.error(errF);
                  commitAndRespond(idActividad, montoReal);
                });
              } else {
                commitAndRespond(idActividad, montoReal);
              }
            }
          );
        }

        function commitAndRespond(idActividad, montoEfectivo) {
          db.run("COMMIT", async () => {
            res.json({
              success: true,
              message: destinoFondo === 'individual' ? "💰 Pago guardado en Fondo Individual." : "✅ Pago procesado exitosamente.",
              nuevoSaldo: nuevoSaldo,
              destino: destinoFondo
            });

            // 📩 LOGICA DE COMPROBANTE
            try {
              // const { generarPDFComprobante, enviarCorreoComprobante } = require('../services/authService'); // REMOVED (Local functions)
              const fs = require('fs');

              const pdfPath = `./comprobante_${dni}_${Date.now()}.pdf`;
              const datosComprobante = {
                nombre: prestamo.nombre,
                dni: dni,
                montoPago: parseFloat(montoEfectivo), // Use actual effective amount
                nuevoSaldo: nuevoSaldo,
                tipoActividad: tipoActividad || "Pago",
                idTransaccion: idActividad
              };

              await generarPDFComprobante(datosComprobante, pdfPath);

              if (prestamo.email) {
                await enviarCorreoComprobante(prestamo.email, prestamo.nombre, pdfPath, datosComprobante);
              }

              setTimeout(() => fs.unlink(pdfPath, () => { }), 10000);

            } catch (e) { console.error("Error Receipts:", e); }
          });
        }
      }
    );
  });
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

      db.get(`
        SELECT p.id AS id_prestamo, p.monto, p.plazo, p.tcea_aplicada
        FROM prestamos p WHERE p.id_cliente = ?
              `, [cliente.id], (err, prestamo) => {
        if (err || !prestamo) {
          db.run("ROLLBACK");
          return res.json({ success: false, message: "Error al recuperar préstamo antes de eliminar." });
        }

        // Calcular total pagado (cuotas con interés)
        const i = Math.pow(1 + parseFloat(prestamo.tcea_aplicada), 1 / 12) - 1;
        const cuota = prestamo.monto * (i / (1 - Math.pow(1 + i, -prestamo.plazo)));
        const totalPagado = cuota * prestamo.plazo;

        // Sumar el total al fondo
        db.run("UPDATE fondos SET monto_total = monto_total + ?", [totalPagado], (err2) => {
          if (err2) console.error("Error sumando fondo:", err2);
        });

        // Registrar en tabla actividad
        const fecha = new Date().toISOString().split('T')[0];
        db.run(
          `INSERT INTO actividad(fecha, id_prestamo, dni_cliente, tipo, monto, descripcion)
            VALUES(?, ?, ?, ?, ?, ?)`,
          [fecha, prestamo.id_prestamo, dni, "Pago completado", totalPagado, `El cliente pagó su préstamo(incluye intereses)`],
          (err3) => {
            if (err3) console.error("Error registrando pago:", err3);
            else console.log(`💰 Actividad registrada: Pago completado por ${dni} `);
          }
        );

        // Luego eliminas los registros normales
        db.run("DELETE FROM prestamos WHERE id_cliente = ?", [cliente.id], (errDelPrestamo) => {
          if (errDelPrestamo) {
            db.run("ROLLBACK");
            return res.json({ success: false, message: "Error al eliminar préstamo" });
          }

          db.run("DELETE FROM clientes WHERE id = ?", [cliente.id], (errDelCliente) => {
            if (errDelCliente) {
              db.run("ROLLBACK");
              return res.json({ success: false, message: "Error al eliminar cliente" });
            }

            db.run("COMMIT");
            res.json({ success: true, message: "✅ Cliente eliminado y pago registrado en actividad." });
          });
        });
      });

    });
  });
};

// =======================================================
// 🔹 CRONOGRAMA DE PAGOS (por cliente)
// =======================================================
exports.obtenerCronograma = (req, res) => {
  const { dni } = req.params;

  const query = `
    SELECT p.monto, p.plazo, p.tcea_aplicada, p.fecha_inicio
    FROM prestamos p
    INNER JOIN clientes c ON p.id_cliente = c.id
    WHERE c.dni = ? AND(p.saldo_pendiente IS NULL OR p.saldo_pendiente > 0.01)
    ORDER BY p.id DESC
  `;

  db.get(query, [dni], (err, prestamo) => {
    if (err) {
      console.error("Error al obtener cronograma:", err);
      return res.status(500).json({ success: false, message: "Error al obtener cronograma" });
    }

    if (!prestamo) {
      return res.json({ success: false, message: "No se encontró préstamo activo para este cliente." });
    }

    const { monto, plazo, tcea_aplicada, fecha_inicio } = prestamo;
    const i = Math.pow(1 + parseFloat(tcea_aplicada), 1 / 12) - 1;
    const cuota = monto * (i / (1 - Math.pow(1 + i, -plazo)));

    const cronograma = [];
    let saldo = monto;
    let fecha = new Date(fecha_inicio);

    for (let k = 1; k <= plazo; k++) {
      const interes = saldo * i;
      const amortizacion = cuota - interes;
      saldo -= amortizacion;

      // avanzar un mes
      const fechaPago = new Date(fecha);
      fechaPago.setMonth(fechaPago.getMonth() + 1);

      cronograma.push({
        nro: k,
        fecha_pago: fechaPago.toISOString().split('T')[0],
        cuota: cuota.toFixed(2),
        interes: interes.toFixed(2),
        amortizacion: amortizacion.toFixed(2),
        saldo: saldo > 0 ? saldo.toFixed(2) : '0.00'
      });

      fecha = fechaPago;
    }

    res.json({
      success: true,
      cuota: cuota.toFixed(2),
      total_pagar: (cuota * plazo).toFixed(2),
      cronograma
    });
  });
};


// =======================================================
// 🔹 FUNCIÓN PARA GENERAR PDF DEL CRONOGRAMA
// =======================================================
async function generarPDFCronograma(datos, rutaArchivo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    doc.fontSize(18).text("Cronograma de Pagos", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12)
      .text(`Cliente: ${datos.nombre} `)
      .text(`Correo: ${datos.email} `)
      .text(`Tipo de préstamo: ${datos.tipo_prestamo} `)
      .text(`Monto total: S / ${datos.monto.toFixed(2)} `)
      .text(`Plazo: ${datos.plazo} meses`)
      .text(`TCEA aplicada: ${(datos.tcea_aplicada * 100).toFixed(2)}% `)
      .moveDown(1);

    doc.fontSize(14).text("Detalle de Cuotas:", { underline: true });
    doc.moveDown(0.5);

    // Cabecera de tabla
    let yHeader = doc.y;
    doc.fontSize(12).text("N° Cuota", 60, yHeader);
    doc.text("Fecha de pago", 150, yHeader);
    doc.text("Monto (S/)", 300, yHeader);
    doc.moveDown(1.5);

    doc.fontSize(11);
    let y = doc.y; // Start Y position

    datos.pagos.forEach(p => {
      // Check for page break
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(p.nro_cuota.toString(), 60, y);
      doc.text(p.fecha_pago, 150, y);
      doc.text(p.monto.toFixed(2), 300, y);
      y += 20; // Increment Y
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}


// =======================================================
// 🔹 FUNCIÓN PARA ENVIAR CORREO CON PDF ADJUNTO
// =======================================================
async function enviarCorreoConPDF(destinatario, nombreCliente, pdfPath, datos) {
  const cuotasPreview = (datos.pagos || []).slice(0, 3).map(p => `
              < tr >
      <td style="padding:6px;border:1px solid #ccc;text-align:center;">${p.nro_cuota}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;">${p.fecha_pago}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;">S/ ${p.monto.toFixed(2)}</td>
    </tr >
              `).join("");

  const html = `
              < div style = "font-family:Arial,sans-serif;" >
      <p>Estimado/a <strong>${nombreCliente}</strong>,</p>
      <p>Adjunto encontrarás tu <strong>cronograma completo de pagos</strong>.</p>
      <h3>Resumen del préstamo:</h3>
      <ul>
        <li><b>Tipo de préstamo:</b> ${datos.tipo_prestamo}</li>
        <li><b>Monto total:</b> S/ ${datos.monto.toFixed(2)}</li>
        <li><b>Plazo:</b> ${datos.plazo} meses</li>
        <li><b>TCEA aplicada:</b> ${(datos.tcea_aplicada * 100).toFixed(2)}%</li>
      </ul>
      <h3>Primeras cuotas:</h3>
      <table style="border-collapse:collapse;width:100%;border:1px solid #ccc;">
        <thead>
          <tr style="background:#0c2340;color:white;">
            <th style="padding:6px;border:1px solid #ccc;">N° Cuota</th>
            <th style="padding:6px;border:1px solid #ccc;">Fecha de pago</th>
            <th style="padding:6px;border:1px solid #ccc;">Monto (S/)</th>
          </tr>
        </thead>
        <tbody>${cuotasPreview}</tbody>
      </table>
      <p>Para más detalles, revisa el PDF adjunto.</p>
      <br>
      <p><strong>Atentamente,</strong><br>Equipo de <b>Banco Brar</b></p>
    </div>
            `;

  // Adjuntar PDF como base64
  const fileBuffer = fs.readFileSync(pdfPath);
  const attachment = fileBuffer.toString('base64');

  const msg = {
    to: destinatario,
    from: { email: process.env.SMTP_FROM, name: 'Banco Brar' },
    subject: 'Tu cronograma de pagos - Banco Brar',
    html,
    attachments: [{
      content: attachment,
      filename: 'Cronograma_Pagos.pdf',
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  };

  await sgMail.send(msg);
  console.log(`📤 Correo enviado a ${destinatario} vía Web API`);
}


// =======================================================
// 🔹 LISTAR COMPROBANTES (HISTORIAL DE PAGOS)
// =======================================================
exports.obtenerComprobantes = (req, res) => {
  const query = `
            SELECT
            a.id,
              a.fecha,
              c.nombre AS nombre_cliente,
                a.monto,
                a.tipo,
                a.descripcion
    FROM actividad a
    JOIN clientes c ON a.dni_cliente = c.dni
    WHERE a.tipo IN('Pago de Cuota', 'Cancelación de Préstamo', 'Abono Individual')
    ORDER BY a.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error obteniendo comprobantes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener comprobantes." });
    }
    res.json({ success: true, comprobantes: rows });
  });
};

/* =======================================================
   🔹 GENERAR PDF COMPROBANTE
   ======================================================= */
async function generarPDFComprobante(datos, rutaArchivo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    doc.fontSize(20).text("Comprobante de Pago", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Fecha: ${new Date().toLocaleDateString()} `);
    doc.text(`Cliente: ${datos.nombre} `);
    doc.text(`DNI: ${datos.dni} `);
    doc.moveDown();

    doc.fontSize(14).text(`Detalle de la Transacción`, { underline: true });
    doc.moveDown();

    if (datos.idTransaccion !== undefined) {
      doc.fontSize(10).text(`Nro.Transacción: ${datos.idTransaccion} `);
      doc.moveDown(0.5);
    } else {
      doc.fontSize(10).text(`Nro.Transacción: (No disponible)`, { color: 'red' });
      doc.moveDown(0.5);
    }

    doc.fontSize(12).text(`Monto Pagado: S / ${datos.montoPago.toFixed(2)} `);
    doc.text(`Concepto: ${datos.tipoActividad} `);
    doc.text(`Nuevo Saldo Pendiente: S / ${datos.nuevoSaldo.toFixed(2)} `);

    doc.moveDown(2);
    doc.fontSize(10).text("Gracias por su pago.", { align: "center" });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/* =======================================================
   🔹 ENVIAR CORREO COMPROBANTE
   ======================================================= */
async function enviarCorreoComprobante(destinatario, nombreCliente, pdfPath, datos) {
  const html = `
          < div style = "font-family:Arial,sans-serif;" >
      <p>Estimado/a <strong>${nombreCliente}</strong>,</p>
      <p>Confirmamos la recepción de su pago por <strong>S/ ${datos.montoPago.toFixed(2)}</strong>.</p>
      <p><strong>Nuevo Saldo:</strong> S/ ${datos.nuevoSaldo.toFixed(2)}</p>
      <p>Adjunto encontrará su comprobante de pago.</p>
      <br>
      <p><strong>Atentamente,</strong><br>Equipo de <b>Banco Brar</b></p>
    </div>
        `;

  const fileBuffer = fs.readFileSync(pdfPath);
  const attachment = fileBuffer.toString('base64');

  const msg = {
    to: destinatario,
    from: { email: process.env.SMTP_FROM, name: 'Banco Brar' },
    subject: 'Comprobante de Pago - Banco Brar',
    html,
    attachments: [{
      content: attachment,
      filename: 'Comprobante_Pago.pdf',
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  };

  await sgMail.send(msg);
  console.log(`📤 Comprobante enviado a ${destinatario} `);
}


