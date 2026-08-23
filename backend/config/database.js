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
        
        // Verify or create feature_requests table automatically
        await client.query(`
            CREATE TABLE IF NOT EXISTS "feature_requests" (
                "id" bigserial PRIMARY KEY,
                "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "module_name" varchar(255) NOT NULL,
                "description" text,
                "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table 'feature_requests' verified/created in database.");
        
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