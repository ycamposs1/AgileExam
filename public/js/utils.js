window.tiposTCEA = {
  personal: 0.26,
  vehicular: 0.15,
  hipotecario: 0.102,
  educativo: 0.168
};

window.calcularFechaFin = (inicio, meses) => {
  if (!inicio || !meses) return "";

  // Create date ensuring we don't have timezone offset issues (using noon)
  const d = new Date(inicio + "T12:00:00");
  const originalDay = d.getDate();

  // Add months
  d.setMonth(d.getMonth() + parseInt(meses));

  // Check for day overflow (e.g. Jan 31 + 1 mo -> Mar 3)
  // If day changed, it means the target month has fewer days.
  // Snap to the last day of the previous month (which is the effective target month).
  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }

  return d.toISOString().split("T")[0];
};

window.mostrarMensaje = (el, txt, clase = "") => {
  el.textContent = txt;
  el.className = clase;
};
