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

    req.session.user = user;
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

  db.get("SELECT monto_total FROM fondos LIMIT 1", (err, row) => {
    const monto = row ? row.monto_total : 0;
    res.json({
      usuario: req.session.user.username,
      monto
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
