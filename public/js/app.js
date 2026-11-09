(function () {
  // Menu mobile
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Formulário de contato -> abre o WhatsApp com a mensagem pronta
  var waForm = document.querySelector('[data-whatsapp-form]');
  if (waForm) {
    waForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = waForm.elements.name.value.trim();
      var message = waForm.elements.message.value.trim();
      if (!name || !message) return;
      var text = 'Olá! Meu nome é ' + name + '.\n' + message;
      window.open('https://wa.me/' + waForm.dataset.wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }

  // Formulário de reserva: vários cães, datas e prévia do valor
  var booking = document.querySelector('[data-booking-form]');
  if (booking) {
    var mode = booking.dataset.mode;
    var single = Number(booking.dataset.hotelSingle), multi = Number(booking.dataset.hotelMulti);
    var dayuse = Number(booking.dataset.dayuse), maxPets = Number(booking.dataset.maxPets);
    var list = booking.querySelector('[data-pets]');
    var tpl = booking.querySelector('#pet-template');
    var addBtn = booking.querySelector('[data-pet-add]');
    var detail = booking.querySelector('[data-price-detail]');
    var total = booking.querySelector('[data-price-total]');
    var checkIn = booking.elements.check_in, checkOut = booking.elements.check_out;

    var money = function (v) {
      return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };
    var cards = function () { return list.querySelectorAll('[data-pet]'); };

    function renumber() {
      cards().forEach(function (card, idx) {
        card.querySelector('[data-pet-title]').textContent = 'Cão ' + (idx + 1);
        card.querySelector('[data-pet-remove]').hidden = idx === 0;
        card.querySelectorAll('[name^="pets["]').forEach(function (el) {
          el.name = el.name.replace(/^pets\[[^\]]*\]/, 'pets[' + idx + ']');
        });
      });
      addBtn.hidden = cards().length >= maxPets;
    }

    function update() {
      if (!total) return;
      var n = cards().length;
      if (mode === 'dayuse') {
        detail.textContent = n + (n > 1 ? ' cães' : ' cão') + ' × ' + money(dayuse);
        total.textContent = money(n * dayuse);
        return;
      }
      if (!checkIn.value || !checkOut.value) { detail.textContent = 'Escolha as datas para ver o valor.'; total.textContent = '—'; return; }
      var nights = Math.round((Date.parse(checkOut.value) - Date.parse(checkIn.value)) / 86400000);
      if (!(nights > 0)) { detail.textContent = 'A saída precisa ser depois da entrada.'; total.textContent = '—'; return; }
      var rate = n >= 2 ? multi : single;
      detail.textContent = nights + (nights > 1 ? ' diárias' : ' diária') + ' × ' + n + (n > 1 ? ' cães' : ' cão') + ' × ' + money(rate);
      total.textContent = money(nights * n * rate);
    }

    addBtn.addEventListener('click', function () {
      if (cards().length >= maxPets) return;
      var html = tpl.innerHTML.replace(/__i__/g, String(cards().length));
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      var card = wrap.firstElementChild;
      while (!card.matches || !card.matches('[data-pet]')) card = card.nextElementSibling;
      list.appendChild(card);
      renumber(); update();
      var first = card.querySelector('input'); if (first) first.focus();
    });
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pet-remove]');
      if (!btn) return;
      btn.closest('[data-pet]').remove();
      renumber(); update();
    });

    if (checkIn && checkOut) {
      checkIn.addEventListener('change', function () {
        if (!checkIn.value) return;
        checkOut.min = checkIn.value;
        if (checkOut.value && checkOut.value <= checkIn.value) checkOut.value = '';
        update();
      });
      checkOut.addEventListener('change', update);
    }
    renumber(); update();
  }

  // Revelar elementos ao rolar a página (não vale para o painel admin)
  if (!document.querySelector('.admin-top') && 'IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var targets = document.querySelectorAll('.card:not(.form-card), .svc-card, .price-card, .feature, .req, .steps li, .faq details, .team-photo, .team-list li, .pack-table, .pack-side > *, .cta-banner');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    targets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  // Confirmação antes de ações perigosas
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
})();
