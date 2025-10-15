require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('views'));

// 🔐 Configurar sesión segura
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 15, // 15 minutos
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ==============================
// 🔹 RUTAS DEL SISTEMA
// ==============================

// Login principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

// Procesar login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM admin WHERE username = ?", [username], async (err, user) => {
    if (err) return res.send("Error al consultar la base de datos");
    if (!user) return res.send("Usuario no encontrado");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("Contraseña incorrecta");

    // Guardar en sesión SOLO los campos necesarios
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email || null,
      movil: user.movil || null
    };

    res.redirect('/admin');
  });
});

// Panel principal (admin)
app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/admin.html');
});

// Secciones
app.get('/clientes', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/clientes.html');
});

app.get('/pep', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/pep.html');
});

app.get('/actividad', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/actividad.html');
});

app.get('/perfil', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/perfil.html');
});

// Crear nuevo admin (opcional)
app.get('/nuevo-admin', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.send(`
    <form method="POST" action="/nuevo-admin">
      <input name="username" placeholder="usuario" />
      <input name="password" placeholder="contraseña" />
      <button type="submit">Crear</button>
    </form>
  `);
});

app.post('/nuevo-admin', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hash], (err) => {
    if (err) return res.send("Error creando usuario.");
    res.send("Usuario creado correctamente.");
  });
});

// 🔹 Mostrar información en navbar
app.get('/api/info', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });

  const userId = req.session.user.id;

  db.get("SELECT username FROM admin WHERE id = ?", [userId], (err, userRow) => {
    if (err || !userRow) return res.status(404).json({ error: "Usuario no encontrado" });

    db.get("SELECT monto_total FROM fondos LIMIT 1", (err2, row) => {
      const monto = row ? row.monto_total : 0;
      res.json({
        usuario: userRow.username,
        monto
      });
    });
  });
});

// 🔹 Obtener perfil actual
app.get('/api/perfil', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });

  db.get("SELECT username, email, movil FROM admin WHERE id = ?", [req.session.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(row);
  });
});

// 🔹 Actualizar datos del perfil
app.post('/api/perfil', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  const { username, email, movil } = req.body;

  db.run("UPDATE admin SET username=?, email=?, movil=? WHERE id=?", 
    [username, email, movil, req.session.user.id], 
    function(err) {
      if (err) return res.json({ error: "Error al actualizar" });

      req.session.user.username = username;
      res.json({ success: true, msg: "Perfil actualizado correctamente" });
    });
});

// 🔹 Cambiar contraseña
app.post('/api/perfil/password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.json({ error: "Las contraseñas no coinciden" });
  }

  db.get("SELECT password FROM admin WHERE id = ?", [req.session.user.id], async (err, row) => {
    if (!row) return res.json({ error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(oldPassword, row.password);
    if (!valid) return res.json({ error: "La contraseña actual es incorrecta" });

    const newHash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE admin SET password=? WHERE id=?", [newHash, req.session.user.id], (err) => {
      if (err) return res.json({ error: "Error al actualizar contraseña" });
      res.json({ success: true, msg: "Contraseña actualizada correctamente" });
    });
  });
});

// 🔹 Cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});


//const axios = require("axios");

// ✅ Nueva ruta usando la API de Factiliza
app.post("/api/reniec", async (req, res) => {
  const { dni } = req.body;

  if (!dni) {
    return res.status(400).json({
      success: false,
      message: "Debe ingresar un DNI"
    });
  }

  try {
    // Construcción de URL según documentación de Factiliza
    const url = `https://api.factiliza.com/v1/dni/info/${dni}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 10000 // 10 segundos de espera
    });

    // Procesamos la respuesta exitosa
    if (response.data && response.data.success && response.data.data) {
      const d = response.data.data;

      console.log("✅ Factiliza OK:", d);

      return res.json({
        success: true,
        message: "Consulta exitosa",
        data: {
            numero: d.numero,
            nombres: d.nombres,
            apellido_paterno: d.apellido_paterno,
            apellido_materno: d.apellido_materno,
            nombre_completo: d.nombre_completo,
            departamento: d.departamento,
            provincia: d.provincia,
            distrito: d.distrito,
            direccion: d.direccion,
            direccion_completa: d.direccion_completa
        }
        });

    } else {
      console.warn("⚠️ Factiliza sin resultados:", response.data);
      return res.status(404).json({
        success: false,
        message: "No se encontró información del DNI"
      });
    }
  } catch (error) {
    console.error("❌ Error Factiliza:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      (status === 401
        ? "Token inválido o sin permisos."
        : "Error al consultar Factiliza. Intente nuevamente más tarde.");

    res.status(status).json({ success: false, message });
  }
});


// 🔹 Obtener lista de clientes con deuda agregada
app.get('/api/clientes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "No autenticado" });

  const query = `
    SELECT
      c.dni,
      c.nombre,
      IFNULL(SUM(p.monto), 0)         AS monto,
      MIN(p.fecha_inicio)             AS fecha_inicio,
      MAX(p.fecha_fin)                AS fecha_fin
    FROM clientes c
    LEFT JOIN prestamos p ON c.id = p.id_cliente
    GROUP BY c.id
    ORDER BY c.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error al obtener clientes:", err);
      return res.status(500).json({ success: false, message: "Error al obtener clientes" });
    }
    res.json({ success: true, clientes: rows });
  });
});
// 🔹 Crear/actualizar cliente y registrar préstamo + descontar fondos (transaccional)
app.post('/api/clientes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "No autenticado" });

  const {
    dni, nombre, nombres,
    apellido_paterno, apellido_materno,
    departamento, direccion,
    monto, fecha_inicio, fecha_fin
  } = req.body;

  if (!dni || !nombre || !monto || !fecha_inicio || !fecha_fin) {
    return res.json({ success: false, message: "Faltan datos obligatorios." });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1) Verificar fondos
    db.get("SELECT monto_total FROM fondos LIMIT 1", (err, rowFondos) => {
      if (err) {
        db.run("ROLLBACK");
        return res.json({ success: false, message: "Error al verificar fondos." });
      }
      if (!rowFondos || rowFondos.monto_total < monto) {
        db.run("ROLLBACK");
        return res.json({ success: false, message: "Fondos insuficientes." });
      }

      // 2) Buscar cliente por DNI
      db.get("SELECT id FROM clientes WHERE dni = ?", [dni], (errC, cli) => {
        if (errC) {
          db.run("ROLLBACK");
          return res.json({ success: false, message: "Error al verificar cliente." });
        }

        const continuarConPrestamo = (id_cliente) => {
          // 3) Insertar préstamo
          db.run(
            "INSERT INTO prestamos (id_cliente, monto, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)",
            [id_cliente, monto, fecha_inicio, fecha_fin],
            function (errP) {
              if (errP) {
                console.error("Err préstamo:", errP);
                db.run("ROLLBACK");
                return res.json({ success: false, message: "Error al registrar préstamo." });
              }

              // 4) Descontar del fondo
              db.run("UPDATE fondos SET monto_total = monto_total - ?", [monto], (errF) => {
                if (errF) {
                  console.error("Err fondos:", errF);
                  db.run("ROLLBACK");
                  return res.json({ success: false, message: "Cliente creado, pero error al descontar fondos." });
                }

                db.run("COMMIT", (errCommit) => {
                  if (errCommit) {
                    console.error("Err commit:", errCommit);
                    db.run("ROLLBACK");
                    return res.json({ success: false, message: "Error al confirmar la transacción." });
                  }
                  return res.json({ success: true, message: "Cliente/préstamo registrados y fondos actualizados." });
                });
              });
            }
          );
        };

        if (cli && cli.id) {
          // Cliente existe: actualizar datos básicos (opcional) y continuar
          db.run(
            `UPDATE clientes 
               SET nombre = ?, direccion = ?, departamento = ?
             WHERE id = ?`,
            [nombre, direccion || "", departamento || "", cli.id],
            (errU) => {
              if (errU) {
                db.run("ROLLBACK");
                return res.json({ success: false, message: "Error al actualizar cliente." });
              }
              continuarConPrestamo(cli.id);
            }
          );
        } else {
          // Cliente NO existe: crearlo y luego continuar
          db.run(
            `INSERT INTO clientes (dni, nombre, direccion, departamento, provincia, distrito, nombres, apellido_paterno, apellido_materno)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dni, nombre, direccion || "", departamento || "", "", "", nombres || "", apellido_paterno || "", apellido_materno || ""],
            function (errI) {
              if (errI) {
                console.error("Err cliente:", errI);
                db.run("ROLLBACK");
                return res.json({ success: false, message: "Error al registrar cliente." });
              }
              continuarConPrestamo(this.lastID);
            }
          );
        }
      });
    });
  });
});




// ==============================
// 🔹 INICIAR SERVIDOR
// ==============================
app.listen(3000, () => console.log("Servidor iniciado en http://localhost:3000"));
