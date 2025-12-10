const authService = require('../services/authService');

exports.renderLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin'); // Redirect if already logged in
  }
  res.render('login', { title: 'Login' });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await authService.findUserByUsername(username);

    if (!user) {
      return res.json({ success: false, message: req.t('error_credentials') });
    }

    const isValid = await authService.verifyPassword(password, user.password);
    if (!isValid) {
      return res.json({ success: false, message: req.t('error_credentials') });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email || null,
      movil: user.movil || null
    };

    res.json({ success: true, message: "OK" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: req.t('error_server') });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};
