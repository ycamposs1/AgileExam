const express = require('express');
const path = require('path');
const router = express.Router();

// Middleware para asegurar que el usuario esté autenticado
function authMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

// Página principal (login)
// Página principal (login) - COMENTADO para usar authRoutes (login.ejs) con i18n
// router.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../public', 'views', 'login.html'));
// });

// Panel principal (admin)
router.get('/admin', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'views', 'admin.html'));
});

// Secciones internas (cargadas en el iframe)
router.get('/clientes', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'views', 'clientes.html'));
});

router.get('/pep', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'views', 'pep.html'));
});

router.get('/actividad', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'views', 'actividad.html'));
});

router.get('/cuadre', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/views/cuadre.html'));
});

router.get('/comprobantes', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/views/comprobantes.html'));
});

router.get('/perfil', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'views', 'perfil.html'));
});

router.get('/mora', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/views/mora.html'));
});

module.exports = router;
