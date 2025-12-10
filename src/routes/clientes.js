const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController'); // 👈 ESTA LÍNEA ES CLAVE

// Rutas principales de clientes
router.get('/clientes', clientesController.obtenerClientes);
router.post('/clientes', clientesController.crearCliente);
// Nueva ruta para obtener detalle del cliente por DNI
router.get('/clientes/:dni', clientesController.obtenerClientePorDni);
//cronograma de cliente
router.get('/clientes/:dni/cronograma', clientesController.obtenerCronograma);



// 🧾 Nueva ruta para eliminar cliente por DNI
router.delete('/clientes/:dni', clientesController.eliminarCliente);

// 💰 Nueva ruta para registrar pago
router.post('/clientes/:dni/pago', clientesController.registrarPago);

module.exports = router;