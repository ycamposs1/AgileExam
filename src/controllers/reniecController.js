const axios = require('axios');
const db = require('../config/database');

exports.consultarDNI = async (req, res) => {
  const { dni } = req.body;
  if (!dni) return res.status(400).json({ success: false, message: "Debe ingresar un DNI" });

  try {
    const url = `https://api.factiliza.com/v1/dni/info/${dni}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    if (response.data && response.data.success && response.data.data) {
      const d = response.data.data;

      return res.json({
        success: true,
        message: "Consulta exitosa",
        data: {
          numero: d.numero,
          nombres: d.nombres,
          apellido_paterno: d.apellido_paterno,
          apellido_materno: d.apellido_materno,
          nombre_completo: d.nombre_completo,
          departamento: d.departamento,
          provincia: d.provincia,
          distrito: d.distrito,
          direccion: d.direccion,
          direccion_completa: d.direccion_completa
        }
      });
    } else {
      res.status(404).json({ success: false, message: "No se encontró información del DNI" });
    }
  } catch (error) {
    console.error("❌ Error Factiliza:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      (status === 401
        ? "Token inválido o sin permisos."
        : "Error al consultar Factiliza. Intente nuevamente más tarde.");

    res.status(status).json({ success: false, message });
  }
};
