require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const i18next = require('./src/config/i18n');
const i18nextMiddleware = require('i18next-http-middleware');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/admin');
const clientesRoutes = require('./src/routes/clientes');
const reniecRoutes = require('./src/routes/reniec');
const actividadRoutes = require('./src/routes/actividad');
const pageRoutes = require('./src/routes/pages'); // Will be replaced

const app = express();

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(i18nextMiddleware.handle(i18next));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 15, httpOnly: true, sameSite: 'lax' }
}));

// Routes
app.use('/', pageRoutes);
app.use('/', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', clientesRoutes);
app.use('/api', reniecRoutes);
app.use('/api', actividadRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));