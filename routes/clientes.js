const express = require('express');
const router = express.Router();
const { listarClientes, crearCliente, eliminarCliente } = require('../controllers/clientesController');

// Lista de clientes
router.get('/clientes', listarClientes);

// Crear cliente con préstamo
router.post('/clientes', crearCliente);

// Eliminar cliente (para pruebas)
router.delete('/clientes/:dni', eliminarCliente);

module.exports = router;
