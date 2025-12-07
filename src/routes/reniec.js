const express = require('express');
const router = express.Router();
const { consultarDNI } = require('../controllers/reniecController');

// Endpoint principal para buscar datos de un DNI
router.post('/reniec', consultarDNI);

module.exports = router;
