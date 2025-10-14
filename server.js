require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
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

// 🔹 NUEVA RUTA: API PARA MOSTRAR DATOS EN LA NAVBAR
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

app.use(express.json());

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

      // Actualiza el nombre en la sesión
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

// ==============================
// 🔹 INICIAR SERVIDOR
// ==============================
app.listen(3000, () => console.log("Servidor iniciado en http://localhost:3000"));
