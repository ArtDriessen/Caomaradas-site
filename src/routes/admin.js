const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.sameOrigin);

const clientIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';

// ---------- Login ----------
router.get('/login', (req, res) => {
  if (auth.isLoggedIn(req)) return res.redirect('/admin');
  return res.render('admin/login', {
    title: 'Entrar',
    error: auth.isConfigured() ? '' : 'O painel ainda não foi configurado (defina ADMIN_USER, ADMIN_PASSWORD e SESSION_SECRET).',
  });
});

router.post('/login', (req, res) => {
  const ip = clientIp(req);
  if (!auth.isConfigured()) return res.redirect('/admin/login');

  if (auth.isBlocked(ip)) {
    return res.status(429).render('admin/login', {
      title: 'Entrar',
      error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    });
  }

  if (auth.checkCredentials(req.body.user, req.body.password)) {
    auth.clearFailures(ip);
    auth.login(res);
    return res.redirect('/admin');
  }

  auth.registerFailure(ip);
  return res.status(401).render('admin/login', { title: 'Entrar', error: 'Usuário ou senha incorretos.' });
});

router.post('/logout', (req, res) => {
  auth.logout(res);
  res.redirect('/admin/login');
});

// ---------- Área protegida ----------
router.use(auth.requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const status = db.STATUSES.includes(req.query.status) ? req.query.status : '';
    const [bookings, counts] = await Promise.all([db.listBookings(status), db.countByStatus()]);
    res.render('admin/dashboard', { title: 'Agendamentos', bookings, counts, activeStatus: status });
  } catch (err) {
    next(err);
  }
});

router.get('/agendamentos/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const booking = Number.isInteger(id) ? await db.getBooking(id) : null;
    if (!booking) return res.status(404).render('404', { title: 'Não encontrado' });
    const pets = await db.getPets(booking);
    return res.render('admin/booking', { title: `Pedido #${booking.id}`, booking, pets, saved: req.query.salvo === '1' });
  } catch (err) {
    return next(err);
  }
});

router.post('/agendamentos/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const status = db.STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!Number.isInteger(id) || !status) return res.status(400).send('Dados inválidos.');
    const adminNotes = String(req.body.admin_notes || '').trim().slice(0, 1000);
    await db.updateBooking(id, { status, admin_notes: adminNotes });
    return res.redirect(`/admin/agendamentos/${id}?salvo=1`);
  } catch (err) {
    return next(err);
  }
});

router.post('/agendamentos/:id/excluir', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isInteger(id)) await db.deleteBooking(id);
    return res.redirect('/admin');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
