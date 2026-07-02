require("dotenv").config();

module.exports = {
    baseUrl: process.env.PYTHON_API_BASE || "http://localhost:8000",
};