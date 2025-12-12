const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const moraController = require('../controllers/moraController');

//Cronograma de cliente (SPECIFIC ROUTE MUST BE BEFORE GENERIC)
router.get('/clientes/:dni/cronograma', clientesController.obtenerCronograma);

// Rutas para clientes
router.get('/clientes', clientesController.obtenerClientes);
router.post('/clientes', clientesController.crearCliente);
router.get('/comprobantes', clientesController.obtenerComprobantes);

// Nueva ruta para obtener detalle del cliente por DNI (GENERIC ROUTE)
router.get('/clientes/:dni', clientesController.obtenerClientePorDni);

// Nueva ruta para eliminar cliente por DNI
router.delete('/clientes/:dni', clientesController.eliminarCliente);

// Nueva ruta para registrar pago
router.post('/clientes/:dni/pago', clientesController.registrarPago);

// Simulador de Mora (Using new controller)
router.get('/mora', moraController.obtenerSimulacionMora);

module.exports = router;