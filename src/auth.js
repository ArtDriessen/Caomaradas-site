const crypto = require('crypto');
const config = require('./config');

const COOKIE = 'pet_admin';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function isConfigured() {
  const a = config.admin;
  return Boolean(a.user && a.password && a.secret && a.secret.length >= 16);
}

function sign(value) {
  return crypto.createHmac('sha256', config.admin.secret).update(value).digest('hex');
}

// Compara em tempo constante (hash antes, para tamanhos iguais)
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function checkCredentials(user, password) {
  const okUser = safeEqual(user || '', config.admin.user);
  const okPass = safeEqual(password || '', config.admin.password);
  return okUser && okPass;
}

function cookieAttrs(maxAgeSeconds) {
  return `Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${config.isProd ? '; Secure' : ''}`;
}

function login(res) {
  const exp = String(Date.now() + TTL_MS);
  const token = `${exp}.${sign(exp)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieAttrs(TTL_MS / 1000)}`);
}

function logout(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttrs(0)}`);
}

function isLoggedIn(req) {
  if (!isConfigured()) return false;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (!(Number(exp) > Date.now())) return false;
  return safeEqual(sig, sign(exp));
}

function requireAdmin(req, res, next) {
  if (isLoggedIn(req)) return next();
  return res.redirect('/admin/login');
}

// Bloqueio simples de tentativas de login por IP (em memória)
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isBlocked(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.reset) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.reset) attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
  else entry.count += 1;
}

function clearFailures(ip) {
  attempts.delete(ip);
}

// Proteção extra contra CSRF: em POST, se houver Origin, ele precisa ser o mesmo host
function sameOrigin(req, res, next) {
  if (req.method !== 'POST') return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).send('Requisição bloqueada.');
    } catch {
      return res.status(403).send('Requisição bloqueada.');
    }
  }
  return next();
}

module.exports = {
  isConfigured,
  checkCredentials,
  login,
  logout,
  isLoggedIn,
  requireAdmin,
  isBlocked,
  registerFailure,
  clearFailures,
  sameOrigin,
};
