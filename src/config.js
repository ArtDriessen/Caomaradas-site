const fs = require('fs');
const path = require('path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

// Se existir public/img/logo.png (ou .svg/.webp/.jpg), ele é usado automaticamente.
function findLogo() {
  for (const ext of ['png', 'svg', 'webp', 'jpg', 'jpeg']) {
    const file = path.join(__dirname, '..', 'public', 'img', `logo.${ext}`);
    if (fs.existsSync(file)) return `/img/logo.${ext}`;
  }
  return '';
}

module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  site: {
    name: env.SITE_NAME || 'Cãomaradas Creche & Hotel',
    tagline: env.SITE_TAGLINE || 'Creche e hotel para cães em Pontal do Paraná. Onde seu pet se sente em casa',
    whatsapp: (env.WHATSAPP_NUMBER || '5541984744751').replace(/\D/g, ''),
    instagram: env.INSTAGRAM_URL || 'https://www.instagram.com/caomaradascrechehotel/',
    address: env.ADDRESS || 'Av. Elis Regina, 549 - Balneário Primavera, Pontal do Paraná - PR, 83255-000',
    phoneDisplay: env.PHONE_DISPLAY || '(41) 98474-4751',
    vetInstagram: env.VET_INSTAGRAM_URL || 'https://www.instagram.com/annazavataro.vet/',
    logo: findLogo(),
  },
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || '',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || '',
  },
  admin: {
    user: env.ADMIN_USER || '',
    password: env.ADMIN_PASSWORD || '',
    secret: env.SESSION_SECRET || '',
  },
};
