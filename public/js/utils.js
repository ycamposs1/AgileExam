window.tiposTCEA = {
  personal: 0.26,
  vehicular: 0.15,
  hipotecario: 0.102,
  educativo: 0.168
};

window.calcularFechaFin = (inicio, meses) => {
  const base = new Date(inicio);
  base.setMonth(base.getMonth() + meses);
  return base.toISOString().split("T")[0];
};

window.mostrarMensaje = (el, txt, clase = "") => {
  el.textContent = txt;
  el.className = clase;
};
