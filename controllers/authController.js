const bcrypt = require('bcryptjs');
const db = require('../db');
const path = require('path');

// ==============================
// 🔹 Mostrar página de login
// ==============================
exports.viewLogin = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
};

// ==============================
// 🔹 Procesar login
// ==============================
exports.login = (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM admin WHERE username = ?", [username], async (err, user) => {
    if (err) return res.send("❌ Error al consultar la base de datos");
    if (!user) return res.send("⚠️ Usuario no encontrado");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("❌ Contraseña incorrecta");

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email || null,
      movil: user.movil || null
    };

    res.redirect('/admin');
  });
};

// ==============================
// 🔹 Cerrar sesión
// ==============================
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

// ==============================
// 🔹 Crear nuevo administrador
// ==============================
exports.crearAdmin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send("⚠️ Usuario y contraseña requeridos.");

  const hash = await bcrypt.hash(password, 10);

  db.run("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hash], (err) => {
    if (err) {
      console.error("Error creando admin:", err);
      return res.send("❌ Error creando usuario (posiblemente duplicado).");
    }
    res.send("✅ Usuario creado correctamente.");
  });
};
