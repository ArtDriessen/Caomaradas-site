const express = require('express');
const db = require('../db');
const labels = require('../labels');
const { pricing, hotelRate, hotelTotal, dayuseTotal, fmtMoney } = require('../pricing');

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

function diffDays(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function normalizeWhatsapp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

// O formulário envia pets[0][pet_name], pets[1][pet_name]... (já interpretado pelo express)
function readPets(body) {
  const raw = body && body.pets;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return list.slice(0, pricing.maxPets).map((p) => ({
    pet_name: clean(p && p.pet_name, 80),
    breed: clean(p && p.breed, 80),
    size: clean(p && p.size, 20),
    neutered: clean(p && p.neutered, 10),
    age_value: parseInt(p && p.age_value, 10),
    age_unit: clean(p && p.age_unit, 10),
    sociable: clean(p && p.sociable, 10),
    vaccinated: clean(p && p.vaccinated, 10),
  }));
}

function validatePet(p, prefix) {
  const errors = [];
  if (p.pet_name.length < 2) errors.push(`${prefix}Informe o nome do cão.`);
  if (!Object.keys(labels.size).includes(p.size)) errors.push(`${prefix}Escolha o porte do cão.`);
  if (p.breed.length < 2) errors.push(`${prefix}Informe a raça (ou "SRD" se não tiver raça definida).`);
  if (!['sim', 'nao'].includes(p.neutered)) errors.push(`${prefix}Informe se o cão é castrado.`);
  if (!Number.isInteger(p.age_value) || p.age_value < 0 || p.age_value > 40) errors.push(`${prefix}Informe a idade do cão.`);
  if (!['anos', 'meses'].includes(p.age_unit)) errors.push(`${prefix}Escolha anos ou meses para a idade.`);
  if (!Object.keys(labels.sociable).includes(p.sociable)) errors.push(`${prefix}Informe se o cão é sociável com outros cães.`);
  if (!['sim', 'nao'].includes(p.vaccinated)) errors.push(`${prefix}Informe se as vacinas estão em dia.`);
  return errors;
}

// service: 'hospedagem' (pré-reserva do hotel), 'avaliacao' (creche) ou 'dayuse'
function validate(body, service) {
  const errors = [];
  const pets = readPets(body);
  const booking = {
    service,
    tutor_name: clean(body.tutor_name, 120),
    whatsapp: normalizeWhatsapp(body.whatsapp),
    email: clean(body.email, 160),
    check_in: clean(body.check_in, 10),
    check_out: clean(body.check_out, 10),
    notes: cleanMultiline(body.notes, 1000),
    nights: null,
    total_value: null,
  };

  if (booking.tutor_name.length < 3) errors.push('Informe o seu nome completo.');
  if (!/^55\d{10,11}$/.test(booking.whatsapp)) errors.push('Informe um WhatsApp válido, com DDD.');
  if (booking.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) errors.push('O e-mail informado não parece válido.');

  if (!pets.length) errors.push('Informe os dados do cão.');
  pets.forEach((p, i) => errors.push(...validatePet(p, pets.length > 1 ? `Cão ${i + 1}: ` : '')));

  const today = todayBR();
  const inLabel = service === 'hospedagem' ? 'data de entrada' : service === 'dayuse' ? 'data do day use' : 'data preferida para a avaliação';
  if (!isValidDate(booking.check_in)) {
    errors.push(`Informe a ${inLabel}.`);
  } else if (booking.check_in < today) {
    errors.push(`A ${inLabel} não pode ser no passado.`);
  }

  if (service !== 'hospedagem') {
    booking.check_out = booking.check_in; // um único dia
  } else if (!isValidDate(booking.check_out)) {
    errors.push('Informe a data de saída.');
  } else if (isValidDate(booking.check_in) && booking.check_out <= booking.check_in) {
    errors.push('A data de saída precisa ser depois da data de entrada.');
  }

  // Valor calculado no servidor (o que aparece no formulário é só uma prévia)
  let summary = null;
  if (!errors.length) {
    if (service === 'hospedagem') {
      const nights = diffDays(booking.check_in, booking.check_out);
      if (nights > pricing.maxNights) {
        errors.push(`Para estadias acima de ${pricing.maxNights} diárias, fale com a gente pelo WhatsApp.`);
      } else {
        booking.nights = nights;
        booking.total_value = hotelTotal(nights, pets.length);
        summary = { kind: 'hospedagem', nights, pets: pets.length, rate: hotelRate(pets.length), total: booking.total_value };
      }
    } else if (service === 'dayuse') {
      booking.total_value = dayuseTotal(pets.length);
      summary = { kind: 'dayuse', pets: pets.length, rate: pricing.dayuse, total: booking.total_value };
    }
  }

  return { errors, booking, pets, summary };
}

const FORM_PAGES = {
  hospedagem: { path: '/agendar', title: 'Pré-reserva do hotel' },
  avaliacao: { path: '/avaliacao', title: 'Agendar avaliação' },
  dayuse: { path: '/dayuse', title: 'Agendar day use' },
};

function showForm(service) {
  return (req, res) => {
    res.render('agendar', { title: FORM_PAGES[service].title, mode: service, form: { pets: [{}] }, errors: [] });
  };
}

function formForRender(body) {
  const pets = readPets(body);
  return { ...body, pets: pets.length ? pets : [{}] };
}

function submitForm(service) {
  return async (req, res) => {
    const page = FORM_PAGES[service];

    // Campo "isca" para robôs: humanos não preenchem
    if (req.body.website) return res.redirect('/');

    const { errors, booking, pets, summary } = validate(req.body, service);
    if (errors.length) {
      return res.status(400).render('agendar', { title: page.title, mode: service, form: formForRender(req.body), errors });
    }

    try {
      await db.createBooking(booking, pets);
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err.message);
      return res.status(500).render('agendar', {
        title: page.title,
        mode: service,
        form: formForRender(req.body),
        errors: ['Não conseguimos registrar o pedido agora. Tente novamente ou fale com a gente pelo WhatsApp.'],
      });
    }

    const fmtDate = res.locals.fmtDate;
    const petLines = pets
      .map((p) => `- ${p.pet_name} (${p.breed}, ${labels.size[p.size]}, ${p.age_value} ${p.age_unit})`)
      .join('\n');
    const head = { hospedagem: 'uma pré-reserva no hotel', avaliacao: 'um pedido de avaliação para a creche', dayuse: 'um pedido de day use' }[service];
    let message = `Olá! Acabei de fazer ${head} pelo site.\nTutor: ${booking.tutor_name}\n${pets.length > 1 ? 'Cães' : 'Cão'}:\n${petLines}\n`;
    if (service === 'hospedagem') {
      message += `Período: de ${fmtDate(booking.check_in)} a ${fmtDate(booking.check_out)} (${summary.nights} diária${summary.nights > 1 ? 's' : ''})\nValor estimado: ${fmtMoney(summary.total)}`;
    } else if (service === 'dayuse') {
      message += `Data: ${fmtDate(booking.check_in)}\nValor estimado: ${fmtMoney(summary.total)}`;
    } else {
      message += `Data preferida: ${fmtDate(booking.check_in)}`;
    }

    return res.render('sucesso', { title: 'Pedido enviado', mode: service, booking, pets, summary, message });
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

router.get('/dayuse', showForm('dayuse'));
router.post('/dayuse', submitForm('dayuse'));

module.exports = router;
