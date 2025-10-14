// server.js
require('dotenv').config();


const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const db = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));

// Configurar sesiones
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
    // darle un tiempo a la cookie/sesion
    cookie: {
    maxAge: 1000 * 60 * 30  // 30 minutos (en milisegundos)
  }

}));

// Ruta para mostrar login
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

// Ruta para procesar login
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

// Ruta para el panel admin
app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/views/admin.html');
});

// Ruta para crear el usuario administrador (solo una vez)
app.get('/crear-admin', async (req, res) => {
  const hash = await bcrypt.hash("123456", 10); // contraseña por defecto
  db.run("INSERT OR IGNORE INTO admin (username, password) VALUES (?, ?)", ["admin", hash]);
  res.send("Administrador creado. Usuario: admin, Contraseña: 123456");
});

app.listen(3000, () => console.log("Servidor iniciado en http://localhost:3000"));

// Ruta para mostrar formulario de nuevo usuario
app.get('/nuevo-admin', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.send(`
    <h2>Crear nuevo administrador</h2>
    <form method="POST" action="/nuevo-admin">
      <input type="text" name="username" placeholder="Nuevo usuario" required><br>
      <input type="password" name="password" placeholder="Contraseña" required><br>
      <button type="submit">Crear usuario</button>
    </form>
    <a href="/admin">Volver al panel</a>
  `);
});

// Ruta para guardar el nuevo usuario
app.post('/nuevo-admin', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.run("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hash], (err) => {
    if (err) {
      return res.send("❌ Error: el usuario ya existe o hubo un problema.");
    }
    res.send("✅ Nuevo usuario creado correctamente.<br><a href='/admin'>Volver al panel</a>");
  });
});

// 
// Middleware para proteger rutas
function auth(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Panel principal con menú
app.get('/admin', auth, (req, res) => {
  res.sendFile(__dirname + '/views/admin.html');
});

// Sección: Clientes Naturales
app.get('/clientes', auth, (req, res) => {
  res.sendFile(__dirname + '/views/clientes.html');
});

// Sección: PEP (Personas Políticamente Expuestas)
app.get('/pep', auth, (req, res) => {
  res.sendFile(__dirname + '/views/pep.html');
});

// Sección: Registro de Actividad
app.get('/actividad', auth, (req, res) => {
  res.sendFile(__dirname + '/views/actividad.html');
});

// Sección: Perfil
app.get('/perfil', auth, (req, res) => {
  res.sendFile(__dirname + '/views/perfil.html');
});

// Cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});
