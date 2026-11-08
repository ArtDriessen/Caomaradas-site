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

  // Formulário de agendamento: creche usa só 1 data
  var booking = document.querySelector('[data-booking-form]');
  if (booking) {
    var radios = booking.querySelectorAll('input[name="service"]');
    var checkoutWrap = booking.querySelector('[data-checkout-wrap]');
    var checkIn = booking.elements.check_in;
    var checkOut = booking.elements.check_out;

    function currentService() {
      var checked = booking.querySelector('input[name="service"]:checked');
      return checked ? checked.value : 'hospedagem';
    }

    function syncService() {
      var isDayCare = currentService() === 'creche';
      checkoutWrap.style.display = isDayCare ? 'none' : '';
      checkOut.required = !isDayCare;
    }

    function syncDates() {
      if (checkIn.value) {
        checkOut.min = checkIn.value;
        if (checkOut.value && checkOut.value <= checkIn.value && currentService() !== 'creche') {
          checkOut.value = '';
        }
      }
    }

    radios.forEach(function (r) { r.addEventListener('change', syncService); });
    checkIn.addEventListener('change', syncDates);
    syncService();
    syncDates();
  }

  // Confirmação antes de ações perigosas
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
})();
