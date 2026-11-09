// Preços do hotel e do day use. Para mudar um valor, altere aqui e publique de novo.
const pricing = {
  hotel: {
    single: 175, // diária com 1 cão
    multi: 150, // diária por cão quando são 2 ou mais cães do mesmo tutor
  },
  dayuse: 100, // por cão
  maxNights: 60,
  maxPets: 6,
};

function hotelRate(pets) {
  return pets >= 2 ? pricing.hotel.multi : pricing.hotel.single;
}

function hotelTotal(nights, pets) {
  return nights * pets * hotelRate(pets);
}

function dayuseTotal(pets) {
  return pets * pricing.dayuse;
}

function fmtMoney(value) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

module.exports = { pricing, hotelRate, hotelTotal, dayuseTotal, fmtMoney };
