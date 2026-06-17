const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function testDbConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("Connected to PostgreSQL successfully.");
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  testDbConnection
};
