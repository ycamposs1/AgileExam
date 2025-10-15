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
    if (err) {
      console.error("❌ Error en base de datos:", err);
      return res.json({ success: false, message: "Error en el servidor." });
    }

    if (!user) {
      return res.json({ success: false, message: "⚠️ Usuario no encontrado." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.json({ success: false, message: "❌ Contraseña incorrecta." });
    }

    // Guardar sesión
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email || null,
      movil: user.movil || null
    };

    // ✅ Responder al fetch con JSON
    res.json({ success: true, message: "Inicio de sesión correcto." });
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

const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configuración del transportador de correo
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ==============================================
// 🔹 Página para solicitar recuperación
// ==============================================
router.get('/recuperar', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'views', 'recuperar.html'));
});

// ==============================================
// 🔹 Procesar solicitud de recuperación
// ==============================================
router.post('/recuperar', (req, res) => {
  const { email } = req.body;

  db.get("SELECT * FROM admin WHERE email = ?", [email], (err, user) => {
    if (err) return res.json({ success: false, message: "Error de base de datos." });
    if (!user) return res.json({ success: false, message: "No existe ningún usuario con ese correo." });

    // Generar token único y fecha de expiración
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = Date.now() + 1000 * 60 * 10; // 10 minutos

    // Guardar token temporalmente
    db.run("UPDATE admin SET reset_token = ?, reset_expira = ? WHERE email = ?", [token, expiracion, email], async (err2) => {
      if (err2) return res.json({ success: false, message: "Error guardando token." });

      const resetLink = `http://localhost:3000/recuperar/${token}`;

      // Enviar correo
      try {
        await transporter.sendMail({
          from: `"Banco BRAR" <${process.env.SMTP_FROM}>`,
          to: email,
          subject: "Recupera tu contraseña - Banco BRAR",
          html: `
            <p>Hola <strong>${user.username}</strong>,</p>
            <p>Has solicitado recuperar tu contraseña. Haz clic en el siguiente enlace para restablecerla (válido por 10 minutos):</p>
            <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
            <p>Si no solicitaste esto, ignora este mensaje.</p>
          `
        });

        res.json({ success: true, message: "Se ha enviado un correo con instrucciones de recuperación." });
      } catch (error) {
        console.error("❌ Error enviando correo:", error);
        res.json({ success: false, message: "No se pudo enviar el correo de recuperación." });
      }
    });
  });
});

// ==============================================
// 🔹 Página del enlace del token
// ==============================================
router.get('/recuperar/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'views', 'reset.html'));
});

// ==============================================
// 🔹 Procesar restablecimiento de contraseña
// ==============================================
router.post('/reset-password', async (req, res) => {
  const { token, nuevaPassword } = req.body;

  db.get("SELECT * FROM admin WHERE reset_token = ?", [token], async (err, user) => {
    if (err) return res.json({ success: false, message: "Error de base de datos." });
    if (!user) return res.json({ success: false, message: "Token inválido o expirado." });
    if (Date.now() > user.reset_expira) return res.json({ success: false, message: "El enlace ha expirado." });

    const hashed = await bcrypt.hash(nuevaPassword, 10);

    db.run("UPDATE admin SET password = ?, reset_token = NULL, reset_expira = NULL WHERE id = ?", [hashed, user.id], (err2) => {
      if (err2) return res.json({ success: false, message: "Error actualizando contraseña." });

      res.json({ success: true, message: "✅ Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
    });
  });
});


module.exports = router;


