const express = require('express');
const router = express.Router();
const {
  getInfo,
  getPerfil,
  updatePerfil,
  changePassword
} = require('../controllers/adminController');

// Mostrar info básica del navbar (usuario y fondo)
router.get('/info', getInfo);

// Obtener perfil actual del admin logueado
router.get('/perfil', getPerfil);

// Actualizar datos del perfil
router.post('/perfil', updatePerfil);

// Cambiar contraseña del admin
router.post('/perfil/password', changePassword);

module.exports = router;