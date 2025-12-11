const db = require('../config/database');

// ==========================================
// 🔓 ABRIR CAJA
// ==========================================
exports.abrirCaja = (req, res) => {
    const { saldoInicial } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    // Verificar si ya hay una caja abierta
    db.get("SELECT id FROM caja_sesiones WHERE estado = 'ABIERTA'", (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Error verificando caja." });

        if (row) {
            return res.status(400).json({ success: false, message: "Ya existe una caja abierta." });
        }

        const fecha = new Date().toISOString(); // UTC standard, or local if preferred

        db.run(`INSERT INTO caja_sesiones (fecha_apertura, saldo_inicial, estado, usuario_id) VALUES (?, ?, 'ABIERTA', ?)`,
            [fecha, saldoInicial, userId],
            function (errInsert) {
                if (errInsert) {
                    console.error(errInsert);
                    return res.status(500).json({ success: false, message: "Error al abrir caja." });
                }
                res.json({ success: true, message: "Caja abierta correctamente.", sesionId: this.lastID });
            }
        );
    });
};

// ==========================================
// 🔒 CERRAR CAJA
// ==========================================
exports.cerrarCaja = (req, res) => {
    const { desglose, saldoFinalReal } = req.body; // desglose: { "200": 1, "100": 2 ... }

    db.get("SELECT id, saldo_inicial FROM caja_sesiones WHERE estado = 'ABIERTA'", (err, sesion) => {
        if (!sesion) return res.status(400).json({ success: false, message: "No hay caja abierta para cerrar." });

        // Calcular teórico
        db.all("SELECT tipo, monto FROM caja_movimientos WHERE sesion_id = ?", [sesion.id], (errMov, movimientos) => {
            if (errMov) return res.status(500).json({ success: false, message: "Error calculando movimientos." });

            let ingresos = 0;
            let egresos = 0;
            movimientos.forEach(m => {
                if (m.tipo === 'INGRESO') ingresos += m.monto;
                if (m.tipo === 'EGRESO') egresos += m.monto;
            });

            const saldoTeorico = sesion.saldo_inicial + ingresos - egresos;
            const fechaCierre = new Date().toISOString();

            db.run(`UPDATE caja_sesiones SET 
                    fecha_cierre = ?, 
                    saldo_final_teorico = ?, 
                    saldo_final_real = ?, 
                    estado = 'CERRADA' 
                    WHERE id = ?`,
                [fechaCierre, saldoTeorico, saldoFinalReal, sesion.id],
                function (errUpdate) {
                    if (errUpdate) return res.status(500).json({ success: false, message: "Error cerrando caja." });

                    res.json({
                        success: true,
                        message: "Caja cerrada.",
                        estadisticas: {
                            saldoInicial: sesion.saldo_inicial,
                            ingresos,
                            egresos,
                            saldoTeorico,
                            saldoReal: saldoFinalReal,
                            diferencia: saldoFinalReal - saldoTeorico
                        }
                    });
                }
            );
        });
    });
};

// ==========================================
// 📊 OBTENER ESTADO
// ==========================================
exports.obtenerEstado = (req, res) => {
    db.get("SELECT * FROM caja_sesiones WHERE estado = 'ABIERTA'", (err, sesion) => {
        if (err) return res.status(500).json({ success: false });

        if (!sesion) {
            return res.json({ success: true, abierta: false });
        }

        db.all("SELECT * FROM caja_movimientos WHERE sesion_id = ? ORDER BY id DESC", [sesion.id], (errMov, movimientos) => {
            let total = sesion.saldo_inicial;
            movimientos.forEach(m => {
                if (m.tipo === 'INGRESO') total += m.monto;
                else total -= m.monto;
            });

            res.json({
                success: true,
                abierta: true,
                sesion,
                movimientos,
                saldoActualCalculado: total
            });
        });
    });
};

// ==========================================
// 🛠️ HELPER: REGISTRAR MOVIMIENTO
// ==========================================
exports.registrarMovimientoInternal = (tipo, monto, descripcion, referenciaId = null) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT id FROM caja_sesiones WHERE estado = 'ABIERTA'", (err, sesion) => {
            if (err) return reject(err);
            if (!sesion) return resolve(false); // No log if closed (or throw error? User preference: maybe just ignore or queue?)

            const fecha = new Date().toISOString();
            db.run(`INSERT INTO caja_movimientos (sesion_id, tipo, monto, descripcion, fecha, referencia_id) VALUES (?, ?, ?, ?, ?, ?)`,
                [sesion.id, tipo, monto, descripcion, fecha, referenciaId],
                (errInsert) => {
                    if (errInsert) reject(errInsert);
                    else resolve(true);
                }
            );
        });
    });
};
