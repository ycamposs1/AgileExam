const bcrypt = require('bcryptjs');
const db = require('../config/database');

// ==============================
// 🔹 Obtener info del navbar
// ==============================
exports.getInfo = (req, res) => {
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
};

// ==============================
// 🔹 Obtener perfil
// ==============================
exports.getPerfil = (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });

  db.get("SELECT username, email, movil FROM admin WHERE id = ?", [req.session.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(row);
  });
};

// ==============================
// 🔹 Actualizar perfil
// ==============================
exports.updatePerfil = (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  const { username, email, movil } = req.body;

  db.run("UPDATE admin SET username=?, email=?, movil=? WHERE id=?",
    [username, email, movil, req.session.user.id],
    function (err) {
      if (err) return res.json({ error: "Error al actualizar" });

      req.session.user.username = username;
      res.json({ success: true, msg: "Perfil actualizado correctamente" });
    });
};

// ==============================
// 🔹 Cambiar contraseña
// ==============================
exports.changePassword = async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword)
    return res.json({ error: "Las contraseñas no coinciden" });

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
};