const express = require('express');
const db = require('../db');
const labels = require('../labels');

const router = express.Router();

const clean = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const cleanMultiline = (value, max) => String(value || '').trim().slice(0, max);

function todayBR() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function normalizeWhatsapp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

// service: 'hospedagem' (pré-reserva do hotel) ou 'avaliacao' (avaliação para a creche)
function validate(body, service) {
  const errors = [];
  const data = {
    service,
    tutor_name: clean(body.tutor_name, 120),
    whatsapp: normalizeWhatsapp(body.whatsapp),
    email: clean(body.email, 160),
    pet_name: clean(body.pet_name, 80),
    size: clean(body.size, 20),
    breed: clean(body.breed, 80),
    neutered: clean(body.neutered, 10),
    age_value: parseInt(body.age_value, 10),
    age_unit: clean(body.age_unit, 10),
    sociable: clean(body.sociable, 10),
    vaccinated: clean(body.vaccinated, 10),
    check_in: clean(body.check_in, 10),
    check_out: clean(body.check_out, 10),
    notes: cleanMultiline(body.notes, 1000),
  };

  if (data.tutor_name.length < 3) errors.push('Informe o seu nome completo.');
  if (!/^55\d{10,11}$/.test(data.whatsapp)) errors.push('Informe um WhatsApp válido, com DDD.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('O e-mail informado não parece válido.');
  if (data.pet_name.length < 2) errors.push('Informe o nome do cão.');
  if (!Object.keys(labels.size).includes(data.size)) errors.push('Escolha o porte do cão.');
  if (data.breed.length < 2) errors.push('Informe a raça (ou "SRD" se não tiver raça definida).');
  if (!['sim', 'nao'].includes(data.neutered)) errors.push('Informe se o cão é castrado.');
  if (!Number.isInteger(data.age_value) || data.age_value < 0 || data.age_value > 40) errors.push('Informe a idade do cão.');
  if (!['anos', 'meses'].includes(data.age_unit)) errors.push('Escolha anos ou meses para a idade.');
  if (!Object.keys(labels.sociable).includes(data.sociable)) errors.push('Informe se o cão é sociável com outros cães.');
  if (!['sim', 'nao'].includes(data.vaccinated)) errors.push('Informe se as vacinas estão em dia.');

  const today = todayBR();
  const inLabel = service === 'avaliacao' ? 'data preferida para a avaliação' : 'data de entrada';
  if (!isValidDate(data.check_in)) {
    errors.push(`Informe a ${inLabel}.`);
  } else if (data.check_in < today) {
    errors.push(`A ${inLabel} não pode ser no passado.`);
  }

  if (service === 'avaliacao') {
    data.check_out = data.check_in; // avaliação é num único dia
  } else if (!isValidDate(data.check_out)) {
    errors.push('Informe a data de saída.');
  } else if (isValidDate(data.check_in) && data.check_out <= data.check_in) {
    errors.push('A data de saída precisa ser depois da data de entrada.');
  }

  return { errors, data };
}

const FORM_PAGES = {
  hospedagem: { path: '/agendar', title: 'Pré-reserva do hotel' },
  avaliacao: { path: '/avaliacao', title: 'Agendar avaliação' },
};

function showForm(service) {
  return (req, res) => {
    res.render('agendar', { title: FORM_PAGES[service].title, mode: service, form: {}, errors: [] });
  };
}

function submitForm(service) {
  return async (req, res) => {
    const page = FORM_PAGES[service];

    // Campo "isca" para robôs: humanos não preenchem
    if (req.body.website) return res.redirect('/');

    const { errors, data } = validate(req.body, service);
    if (errors.length) {
      return res.status(400).render('agendar', { title: page.title, mode: service, form: req.body, errors });
    }

    try {
      await db.createBooking(data);
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err.message);
      return res.status(500).render('agendar', {
        title: page.title,
        mode: service,
        form: req.body,
        errors: ['Não conseguimos registrar o pedido agora. Tente novamente ou fale com a gente pelo WhatsApp.'],
      });
    }

    const ageText = `${data.age_value} ${data.age_unit}`;
    const pet = `${data.pet_name} (${data.breed}, ${labels.size[data.size]}, ${ageText})`;
    const message =
      service === 'avaliacao'
        ? `Olá! Acabei de pedir uma avaliação para a creche pelo site.\nTutor: ${data.tutor_name}\nCão: ${pet}\nData preferida: ${res.locals.fmtDate(data.check_in)}`
        : `Olá! Acabei de fazer uma pré-reserva no hotel pelo site.\nTutor: ${data.tutor_name}\nCão: ${pet}\nPeríodo: de ${res.locals.fmtDate(data.check_in)} a ${res.locals.fmtDate(data.check_out)}`;

    return res.render('sucesso', { title: 'Pedido enviado', mode: service, booking: data, message });
  };
}

router.get('/', (req, res) => {
  res.render('index', { title: '' });
});

router.get('/servicos', (req, res) => res.redirect('/#servicos'));
router.get('/servicos/hotel', (req, res) => {
  res.render('servicos-hotel', {
    title: 'Hotel para cães',
    description: 'Hotel para cães em Pontal do Paraná: ambiente seguro, climatizado e com supervisão constante.',
  });
});
router.get('/servicos/creche', (req, res) => {
  res.render('servicos-creche', {
    title: 'Creche e day use para cães',
    description: 'Creche e day use para cães em Pontal do Paraná. Agende uma avaliação do seu pet.',
  });
});

router.get('/agendar', (req, res) => {
  // Links antigos (?servico=creche) agora levam à avaliação
  if (req.query.servico === 'creche') return res.redirect('/avaliacao');
  return showForm('hospedagem')(req, res);
});
router.post('/agendar', submitForm('hospedagem'));

router.get('/avaliacao', showForm('avaliacao'));
router.post('/avaliacao', submitForm('avaliacao'));

module.exports = router;
