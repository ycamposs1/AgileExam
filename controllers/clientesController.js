const db = require('../db');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('dotenv').config();



// =======================================================
// 🔹 CONFIGURACIÓN DE TRANSPORTADOR DE CORREO
// =======================================================
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
      IFNULL(p.tipo_prestamo, '') AS tipo_prestamo,
      IFNULL(p.tcea_aplicada, 0) AS tcea_aplicada,
      IFNULL(p.monto, 0) AS monto,
      IFNULL(p.plazo, 0) AS plazo,
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

    // 📊 Calculamos información adicional
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
    tipo_prestamo,
    tcea_aplicada,
    fecha_inicio,
    fecha_fin
  } = req.body;

  // Validación de campos requeridos
  if (!dni || !nombre || !email || !monto || !fecha_inicio || !fecha_fin || !tipo_prestamo || !tcea_aplicada) {
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
async function crearPrestamo(idCliente) {
  const insertarPrestamo = `
    INSERT INTO prestamos (id_cliente, tipo_prestamo, monto, plazo, tcea_aplicada, fecha_inicio, fecha_fin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(insertarPrestamo, [idCliente, tipo_prestamo, monto, plazo, tcea_aplicada, fecha_inicio, fecha_fin], async function (err) {
    if (err) {
      console.error("Error préstamo:", err);
      return res.status(500).json({ success: false, message: "Error al registrar préstamo." });
    }

    // Actualizar fondo total
    db.run("UPDATE fondos SET monto_total = monto_total - ?", [monto], async (err2) => {
      if (err2) {
        console.error("Error actualizando fondos:", err2);
        return res.status(500).json({ success: false, message: "Error al actualizar fondo." });
      }

      // VALIDAR LUEGO 

      // 🧮 Validar valores numéricos
      const plazoNum = parseInt(plazo);
      const tceaNum = parseFloat(tcea_aplicada);

      if (isNaN(plazoNum) || plazoNum <= 0) {
        console.error("❌ Plazo inválido o no definido:", plazo);
        return res.status(400).json({ success: false, message: "El plazo del préstamo no es válido." });
      }

      // ✅ Generar cronograma con TCEA incluida
      const pagos = generarCronograma(fecha_inicio, monto, plazoNum, tceaNum);
      if (!pagos || pagos.length === 0) {
        console.error("❌ No se generaron pagos correctamente.");
        return res.status(500).json({ success: false, message: "Error generando cronograma de pagos." });
      }

      console.table(pagos);

      // ✅ Generar PDF del cronograma
      const pdfPath = `./cronograma_${dni}.pdf`;
      await generarPDFCronograma({
        nombre,
        email,
        tipo_prestamo,
        monto,
        plazo: plazoNum,
        tcea_aplicada: tceaNum,
        pagos
      }, pdfPath);

      // ✅ Enviar correo al cliente
      await enviarCorreoConPDF(email, nombre, pdfPath, {
        nombre,
        email,
        tipo_prestamo,
        monto,
        plazo: plazoNum,
        tcea_aplicada: tceaNum,
        pagos
      });



      // ✅ Respuesta al frontend
      res.json({
        success: true,
        message: `✅ Cliente registrado correctamente y cronograma enviado a ${email}.`,
        cronograma: pagos
      });

      // 🧹 Limpieza del archivo temporal
      setTimeout(() => {
        fs.unlink(pdfPath, () => {});
      }, 10000);
    });
  });
}


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
      .text(`Cliente: ${datos.nombre}`)
      .text(`Correo: ${datos.email}`)
      .text(`Tipo de préstamo: ${datos.tipo_prestamo}`)
      .text(`Monto total: S/ ${datos.monto.toFixed(2)}`)
      .text(`Plazo: ${datos.plazo} meses`)
      .text(`TCEA aplicada: ${(datos.tcea_aplicada * 100).toFixed(2)}%`)
      .moveDown(1);

    doc.fontSize(14).text("Detalle de Cuotas:", { underline: true });
    doc.moveDown(0.5);

    // Cabecera de tabla
    doc.fontSize(12).text("N° Cuota", 60);
    doc.text("Fecha de pago", 150);
    doc.text("Monto (S/)", 300);
    doc.moveDown(0.3);

    doc.fontSize(11);
    datos.pagos.forEach(p => {
      doc.text(p.nro_cuota.toString(), 60);
      doc.text(p.fecha_pago, 150);
      doc.text(p.monto.toFixed(2), 300);
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
  // Creamos una mini tabla HTML de las primeras 3 cuotas
  const cuotasPreview = datos.pagos
    .slice(0, 3)
    .map(p => `
      <tr>
        <td style="padding:6px;border:1px solid #ccc;text-align:center;">${p.nro_cuota}</td>
        <td style="padding:6px;border:1px solid #ccc;text-align:center;">${p.fecha_pago}</td>
        <td style="padding:6px;border:1px solid #ccc;text-align:center;">S/ ${p.monto.toFixed(2)}</td>
      </tr>
    `).join("");

  const mailOptions = {
    from: `"Banco Brar" <${process.env.SMTP_FROM}>`,
    to: destinatario,
    subject: "Tu cronograma de pagos - Banco Brar",
    html: `
      <div style="font-family:Arial,sans-serif;">
        <p>Estimado/a <strong>${nombreCliente}</strong>,</p>
        <p>Adjunto encontrarás tu <strong>cronograma completo de pagos</strong> correspondiente a tu préstamo registrado en nuestro sistema.</p>

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

        <p>
          El pago debe realizarse 
          <b>cada mes en la misma fecha de inicio</b> 
          ${
            datos.pagos && datos.pagos.length > 0
              ? `(${datos.pagos[0].fecha_pago.split("-")[2]} de cada mes)`
              : "(según el cronograma adjunto)"
          }.
        </p>

        <p>Para más detalles, revisa el PDF adjunto.</p>

        <br>
        <p><strong>Atentamente,</strong><br>Equipo de <b>Banco Brar</b></p>
      </div>
    `,
    attachments: [
      {
        filename: 'Cronograma_Pagos.pdf',
        path: pdfPath
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📤 Correo enviado a ${destinatario}`);
  } catch (err) {
    console.error("❌ Error enviando correo:", err);
  }
}


