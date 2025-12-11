const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { isAuthenticated } = require('../middlewares/authMiddleware'); // Assuming this exists or similar

// Protect all routes
router.use(isAuthenticated);

router.post('/abrir', cajaController.abrirCaja);
router.post('/cerrar', cajaController.cerrarCaja);
router.get('/estado', cajaController.obtenerEstado);

module.exports = router;
