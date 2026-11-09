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

  // Formulário de pré-reserva: a saída precisa ser depois da entrada
  var booking = document.querySelector('[data-booking-form]');
  if (booking && booking.elements.check_in && booking.elements.check_out) {
    var checkIn = booking.elements.check_in;
    var checkOut = booking.elements.check_out;
    checkIn.addEventListener('change', function () {
      if (!checkIn.value) return;
      checkOut.min = checkIn.value;
      if (checkOut.value && checkOut.value <= checkIn.value) checkOut.value = '';
    });
  }

  // Confirmação antes de ações perigosas
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
})();
