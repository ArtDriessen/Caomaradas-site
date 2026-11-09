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

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      service ENUM('hospedagem','creche','avaliacao') NOT NULL DEFAULT 'hospedagem',
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
  // Bancos criados na primeira versão só aceitavam 'hospedagem' e 'creche'. Esta linha é segura de repetir.
  await pool.query(
    "ALTER TABLE bookings MODIFY service ENUM('hospedagem','creche','avaliacao') NOT NULL DEFAULT 'hospedagem'"
  );
}

async function createBooking(b) {
  const [result] = await pool.execute(
    `INSERT INTO bookings
      (service, tutor_name, whatsapp, email, pet_name, size, breed, neutered,
       age_value, age_unit, sociable, vaccinated, check_in, check_out, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      b.service, b.tutor_name, b.whatsapp, b.email || null, b.pet_name, b.size,
      b.breed, b.neutered, b.age_value, b.age_unit, b.sociable, b.vaccinated,
      b.check_in, b.check_out, b.notes || null,
    ]
  );
  return result.insertId;
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

async function updateBooking(id, { status, admin_notes }) {
  await pool.execute('UPDATE bookings SET status = ?, admin_notes = ? WHERE id = ?', [
    status,
    admin_notes || null,
    id,
  ]);
}

async function deleteBooking(id) {
  await pool.execute('DELETE FROM bookings WHERE id = ?', [id]);
}

module.exports = {
  STATUSES,
  init,
  createBooking,
  listBookings,
  countByStatus,
  getBooking,
  updateBooking,
  deleteBooking,
};
