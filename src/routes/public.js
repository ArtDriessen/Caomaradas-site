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

function validate(body) {
  const errors = [];
  const data = {
    service: clean(body.service, 20),
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

  if (!Object.keys(labels.service).includes(data.service)) errors.push('Escolha o tipo de serviço.');
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
  if (!isValidDate(data.check_in)) {
    errors.push('Informe a data de entrada.');
  } else if (data.check_in < today) {
    errors.push('A data de entrada não pode ser no passado.');
  }

  if (data.service === 'creche') {
    data.check_out = data.check_in; // creche é no mesmo dia
  } else if (!isValidDate(data.check_out)) {
    errors.push('Informe a data de saída.');
  } else if (isValidDate(data.check_in) && data.check_out <= data.check_in) {
    errors.push('A data de saída precisa ser depois da data de entrada.');
  }

  return { errors, data };
}

router.get('/', (req, res) => {
  res.render('index', { title: '' });
});

router.get('/agendar', (req, res) => {
  const service = labels.service[req.query.servico] ? req.query.servico : 'hospedagem';
  res.render('agendar', { title: 'Agendar', form: { service }, errors: [] });
});

router.post('/agendar', async (req, res) => {
  // Campo "isca" para robôs: humanos não preenchem
  if (req.body.website) return res.redirect('/');

  const { errors, data } = validate(req.body);
  if (errors.length) {
    return res.status(400).render('agendar', { title: 'Agendar', form: req.body, errors });
  }

  try {
    await db.createBooking(data);
  } catch (err) {
    console.error('Erro ao salvar agendamento:', err.message);
    return res.status(500).render('agendar', {
      title: 'Agendar',
      form: req.body,
      errors: ['Não conseguimos registrar o pedido agora. Tente novamente ou fale com a gente pelo WhatsApp.'],
    });
  }

  const ageText = `${data.age_value} ${data.age_unit}`;
  const period =
    data.service === 'creche'
      ? `dia ${res.locals.fmtDate(data.check_in)}`
      : `de ${res.locals.fmtDate(data.check_in)} a ${res.locals.fmtDate(data.check_out)}`;
  const message =
    `Olá! Acabei de fazer um pedido de ${labels.service[data.service].toLowerCase()} pelo site.\n` +
    `Tutor: ${data.tutor_name}\nCão: ${data.pet_name} (${data.breed}, ${labels.size[data.size]}, ${ageText})\n` +
    `Período: ${period}`;

  return res.render('sucesso', { title: 'Pedido enviado', booking: data, message });
});

module.exports = router;
