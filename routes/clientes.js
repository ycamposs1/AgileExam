const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController'); // 👈 ESTA LÍNEA ES CLAVE

// Rutas principales de clientes
router.get('/clientes', clientesController.obtenerClientes);
router.post('/clientes', clientesController.crearCliente);

// 🧾 Nueva ruta para eliminar cliente por DNI
router.delete('/clientes/:dni', clientesController.eliminarCliente);

module.exports = router;
