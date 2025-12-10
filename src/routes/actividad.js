const express = require('express');
const db = require('../../db');
const router = express.Router();

router.get('/actividad', (req, res) => {
  db.all(`
    SELECT * FROM actividad ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Error obteniendo actividad:", err);
      return res.status(500).json({ success: false, message: "Error al obtener actividad." });
    }
    res.json({ success: true, movimientos: rows });
  });
});

module.exports = router;
