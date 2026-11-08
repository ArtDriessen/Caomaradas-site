const path = require('path');
const express = require('express');
const config = require('./src/config');
const db = require('./src/db');
const labels = require('./src/labels');
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.set('trust proxy', 1); // a Hostinger fica atrás de um proxy HTTPS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

// Cabeçalhos básicos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/admin')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProd ? '7d' : 0 }));

// Variáveis disponíveis em todas as views
app.use((req, res, next) => {
  res.locals.site = config.site;
  res.locals.labels = labels;
  res.locals.currentPath = req.path;
  res.locals.waLink = (text) =>
    `https://wa.me/${config.site.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  res.locals.fmtDate = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };
  res.locals.today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('500', { title: 'Algo deu errado' });
});

// O site sobe mesmo se o banco estiver fora do ar; a tabela é criada quando houver conexão.
async function initDatabase(attempt = 1) {
  try {
    await db.init();
    console.log('Banco de dados pronto.');
  } catch (err) {
    console.error(`Falha ao preparar o banco (tentativa ${attempt}): ${err.message}`);
    if (attempt < 5) setTimeout(() => initDatabase(attempt + 1), 10000);
  }
}

app.listen(config.port, () => {
  console.log(`${config.site.name} rodando na porta ${config.port}`);
  initDatabase();
});
