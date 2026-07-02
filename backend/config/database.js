require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function testDbConnection() {
    try {
        const client = await pool.connect();
        console.log("Connected to Neon PostgreSQL");
        client.release();
    } catch (error) {
        console.error("!!!!!!Failed to connect to Neon PostgreSQL");
        console.error(error);
        throw error;
    }
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    testDbConnection,
};