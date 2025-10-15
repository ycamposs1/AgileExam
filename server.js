require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientesRoutes = require('./routes/clientes');
const reniecRoutes = require('./routes/reniec');
const actividadRoutes = require('./routes/actividad');


const app = express();

// Middleware base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sesión segura
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 15, httpOnly: true, sameSite: 'lax' }
}));


// Rutas
app.use('/', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', clientesRoutes);
app.use('/api', reniecRoutes);
app.use('/api', actividadRoutes);


const pageRoutes = require('./routes/pages');

app.use('/', pageRoutes);

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));