require('dotenv').config(); // Load environment variables from .env file

const { Client } = require('pg');

// PostgreSQL client setup
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: true,
  },
});

// Connect to CockroachDB
const connectDB = async () => {
  try {
    await client.connect();
    console.log('Connected to CockroachDB');
  } catch (err) {
    console.error('Error connecting to CockroachDB', err);
  }
};

module.exports = { client, connectDB };
