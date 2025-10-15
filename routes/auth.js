const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const path = require('path');

const router = express.Router();

// ==============================
// 🔹 Página de login
// ==============================
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'views', 'login.html'));
});

// ==============================
// 🔹 Procesar inicio de sesión
// ==============================
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM admin WHERE username = ?", [username], async (err, user) => {
    if (err) return res.send("❌ Error al consultar la base de datos");
    if (!user) return res.send("⚠️ Usuario no encontrado");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("❌ Contraseña incorrecta");

    // Guardar datos esenciales en sesión
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email || null,
      movil: user.movil || null
    };

    res.redirect('/admin');
  });
});

// ==============================
// 🔹 Cerrar sesión
// ==============================
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ==============================
// 🔹 Crear nuevo admin (opcional)
// ==============================
router.get('/nuevo-admin', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.send(`
    <form method="POST" action="/nuevo-admin">
      <input name="username" placeholder="Usuario" required />
      <input name="password" type="password" placeholder="Contraseña" required />
      <button type="submit">Crear</button>
    </form>
  `);
});

router.post('/nuevo-admin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.send("⚠️ Debe ingresar un usuario y contraseña.");
  }

  const hash = await bcrypt.hash(password, 10);

  db.run("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hash], (err) => {
    if (err) {
      console.error("Error al crear admin:", err);
      return res.send("❌ Error creando usuario (posible duplicado).");
    }
    res.send("✅ Usuario creado correctamente.");
  });
});

module.exports = router;
