const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
  dateStrings: true, // DATE volta como 'YYYY-MM-DD' (sem problemas de fuso)
});

const STATUSES = ['pendente', 'confirmado', 'cancelado', 'concluido'];

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return Number(rows[0].n) > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Cria as tabelas e aplica as migrações. É seguro rodar a cada inicialização.
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      service ENUM('hospedagem','creche','avaliacao','dayuse') NOT NULL DEFAULT 'hospedagem',
      tutor_name VARCHAR(120) NOT NULL,
      whatsapp VARCHAR(20) NOT NULL,
      email VARCHAR(160) NULL,
      pet_name VARCHAR(80) NOT NULL,
      size ENUM('pequeno','medio','grande') NOT NULL,
      breed VARCHAR(80) NOT NULL,
      neutered ENUM('sim','nao') NOT NULL,
      age_value SMALLINT UNSIGNED NOT NULL,
      age_unit ENUM('anos','meses') NOT NULL DEFAULT 'anos',
      sociable ENUM('sim','nao','depende') NOT NULL,
      vaccinated ENUM('sim','nao') NOT NULL,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      notes TEXT NULL,
      status ENUM('pendente','confirmado','cancelado','concluido') NOT NULL DEFAULT 'pendente',
      admin_notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_check_in (check_in)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  // Migrações de bancos criados nas versões anteriores
  await pool.query(
    "ALTER TABLE bookings MODIFY service ENUM('hospedagem','creche','avaliacao','dayuse') NOT NULL DEFAULT 'hospedagem'"
  );
  await ensureColumn('bookings', 'pets_count', 'SMALLINT UNSIGNED NOT NULL DEFAULT 1');
  await ensureColumn('bookings', 'nights', 'SMALLINT UNSIGNED NULL');
  await ensureColumn('bookings', 'total_value', 'DECIMAL(10,2) NULL');

  // Todos os cães do pedido (o primeiro também fica nas colunas da tabela bookings)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_pets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      booking_id INT UNSIGNED NOT NULL,
      pet_name VARCHAR(80) NOT NULL,
      size ENUM('pequeno','medio','grande') NOT NULL,
      breed VARCHAR(80) NOT NULL,
      neutered ENUM('sim','nao') NOT NULL,
      age_value SMALLINT UNSIGNED NOT NULL,
      age_unit ENUM('anos','meses') NOT NULL DEFAULT 'anos',
      sociable ENUM('sim','nao','depende') NOT NULL,
      vaccinated ENUM('sim','nao') NOT NULL,
      INDEX idx_booking (booking_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

// booking: dados do pedido; pets: lista de cães (pelo menos 1)
async function createBooking(b, pets) {
  const first = pets[0];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO bookings
        (service, tutor_name, whatsapp, email, pet_name, size, breed, neutered,
         age_value, age_unit, sociable, vaccinated, check_in, check_out, notes,
         pets_count, nights, total_value)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b.service, b.tutor_name, b.whatsapp, b.email || null, first.pet_name, first.size, first.breed,
        first.neutered, first.age_value, first.age_unit, first.sociable, first.vaccinated,
        b.check_in, b.check_out, b.notes || null,
        pets.length, b.nights == null ? null : b.nights, b.total_value == null ? null : b.total_value,
      ]
    );
    const bookingId = result.insertId;
    for (const p of pets) {
      await conn.execute(
        `INSERT INTO booking_pets
          (booking_id, pet_name, size, breed, neutered, age_value, age_unit, sociable, vaccinated)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [bookingId, p.pet_name, p.size, p.breed, p.neutered, p.age_value, p.age_unit, p.sociable, p.vaccinated]
      );
    }
    await conn.commit();
    return bookingId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listBookings(status) {
  if (status && STATUSES.includes(status)) {
    const [rows] = await pool.execute(
      'SELECT * FROM bookings WHERE status = ? ORDER BY check_in ASC, id DESC LIMIT 500',
      [status]
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC, id DESC LIMIT 500');
  return rows;
}

async function countByStatus() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM bookings GROUP BY status');
  const counts = { pendente: 0, confirmado: 0, cancelado: 0, concluido: 0 };
  for (const r of rows) counts[r.status] = Number(r.total);
  return counts;
}

async function getBooking(id) {
  const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [id]);
  return rows[0] || null;
}

// Pedidos antigos (antes de existir booking_pets) não têm linhas: usa os dados da própria reserva.
async function getPets(booking) {
  const [rows] = await pool.execute('SELECT * FROM booking_pets WHERE booking_id = ? ORDER BY id ASC', [booking.id]);
  if (rows.length) return rows;
  return [
    {
      pet_name: booking.pet_name, size: booking.size, breed: booking.breed, neutered: booking.neutered,
      age_value: booking.age_value, age_unit: booking.age_unit, sociable: booking.sociable, vaccinated: booking.vaccinated,
    },
  ];
}

async function updateBooking(id, { status, admin_notes }) {
  await pool.execute('UPDATE bookings SET status = ?, admin_notes = ? WHERE id = ?', [
    status,
    admin_notes || null,
    id,
  ]);
}

async function deleteBooking(id) {
  await pool.execute('DELETE FROM booking_pets WHERE booking_id = ?', [id]);
  await pool.execute('DELETE FROM bookings WHERE id = ?', [id]);
}

module.exports = {
  STATUSES,
  init,
  createBooking,
  listBookings,
  countByStatus,
  getBooking,
  getPets,
  updateBooking,
  deleteBooking,
};
