# 🏦 Banco BRAR – Sistema de Gestión de Préstamos Automatizado

**Autor:** Fernando Campos Siccha  
**Universidad:** Universidad Privada Antenor Orrego (UPAO), Perú 🇵🇪  
**Curso:** AGILE DEVELOPMENT  

---

## 📋 Enunciado del problema

Tengo un **negocio de préstamos** y actualmente registro los préstamos **de forma manual**, lo que ocasiona **errores al registrar al cliente y sus pagos**.  
Para evitar estos inconvenientes, deseo una aplicación que me permita:

- **Identificar correctamente al cliente**.  
- **Registrar el préstamo** (nombre, fecha, monto, interés y plazo).  
- **Generar automáticamente el cronograma de pagos** tanto para el cliente como para mi negocio.  

Además, se requiere que el sistema **envíe automáticamente un correo electrónico** con el cronograma al cliente y **registre internamente cada movimiento** financiero (préstamos otorgados, pagos o eliminaciones).

---

## 🚀 Funcionalidades principales

- 👤 **Registro automático de clientes** (vía RENIEC) con validación por DNI.  
- 🏛️ **Gestión de clientes PEP** (Personas Expuestas Políticamente) con preguntas adicionales de origen y destino de fondos.  
- 💸 **Creación de préstamos** con cálculo automático de:
  - TCEA (Tasa de Costo Efectivo Anual)
  - Cuota mensual
  - Monto total a pagar  
- 🧾 **Generación automática del cronograma de pagos** (PDF adjunto al correo).  
- 📤 **Envío de correo automático** al cliente con sus tres primeras cuotas y el PDF completo (vía SendGrid).  
- 💼 **Control de fondos disponibles:** evita otorgar préstamos si no hay dinero suficiente.  
- 🧮 **Registro de actividad:** cada préstamo, pago o eliminación genera una entrada con su ID, monto y tipo de movimiento.  
- 📈 **Panel administrativo completo**: visualiza clientes, préstamos y actividades.  
- 🔐 **Inicio de sesión seguro** con sesión persistente y opción de **recuperar contraseña** vía correo electrónico.  
- 🌙 **Interfaz moderna y adaptable (responsive)** con TailwindCSS.

---

## ⚙️ Requerimientos funcionales

| ID | Descripción | Estado |
|----|--------------|--------|
| RF01 | El sistema debe permitir el registro de clientes con validación RENIEC por DNI. | ✅ |
| RF02 | El sistema debe registrar préstamos con los datos: monto, plazo, tipo y TCEA. | ✅ |
| RF03 | El sistema debe calcular automáticamente la cuota mensual y el total a pagar. | ✅ |
| RF04 | El sistema debe generar y enviar al cliente el cronograma de pagos en PDF. | ✅ |
| RF05 | El sistema debe registrar toda transacción (alta o baja de préstamo) en una tabla de actividad. | ✅ |
| RF06 | El sistema debe impedir la creación de préstamos si los fondos son insuficientes. | ✅ |
| RF07 | El sistema debe permitir recuperar la contraseña del administrador mediante correo. | ✅ |
| RF08 | El sistema debe diferenciar clientes naturales y PEP, con campos adicionales para estos últimos. | ✅ |
| RF09 | El sistema debe mostrar el historial de préstamos y cronogramas por cliente. | ✅ |
| RF10 | El sistema debe permitir eliminar un cliente solo si ya pagó su deuda, sumando el dinero a los fondos. | ✅ |

---

## 🧩 Requerimientos no funcionales

| ID | Descripción | Cumple |
|----|--------------|--------|
| RNF01 | La interfaz debe ser responsiva y usable desde dispositivos móviles. | ✅ |
| RNF02 | El sistema debe enviar correos mediante una API segura (SendGrid). | ✅ |
| RNF03 | Las contraseñas deben almacenarse con hash (bcrypt). | ✅ |
| RNF04 | Las variables sensibles deben protegerse con dotenv (.env). | ✅ |
| RNF05 | El sistema debe responder en menos de 3 segundos por operación. | ✅ |
| RNF06 | Los datos deben almacenarse en una base de datos local SQLite confiable. | ✅ |
| RNF07 | El sistema debe ser desplegable en Render o Vercel. | ✅ |

---

## 🧰 Tecnologías utilizadas

| Categoría | Tecnología |
|------------|-------------|
| Backend | Node.js + Express |
| Base de datos | SQLite3 |
| Frontend | HTML + TailwindCSS + JavaScript (vanilla) |
| Seguridad | bcryptjs + express-session |
| Generación de PDF | pdfkit |
| Envío de correos | SendGrid Web API |
| Despliegue | Render |
| Utilidades | dotenv, nodemailer, path, fs |

---

## 💾 Estructura del proyecto

📦 agileParcialExam/
├── 📁 controllers/
│   ├── adminController.js
│   ├── authController.js
│   ├── clientesController.js
│   └── reniecController.js
│
├── 📁 routes/
│   ├── admin.js
│   ├── auth.js
│   ├── clientes.js
│   ├── pages.js
│   └── reniec.js
│
├── 📁 public/
│   ├── 📁 css/
│   │   └── clientes.css
│   ├── 📁 js/
│   │   ├── clientes.js
│   │   └── utils.js
│   └── 📁 views/
│       ├── login.html
│       ├── admin.html
│       ├── clientes.html
│       ├── pep.html
│       ├── actividad.html
│       └── perfil.html
│
├── 📄 db.js
├── 📄 server.js
├── 📄 package.json
├── 📄 .env
└── 📄 README.md

