require("dotenv").config();

const requiredEnvVars = [
    "DATABASE_URL",
    "GROQ_API_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

const missing = requiredEnvVars.filter(
    (variable) => !process.env[variable]
);

if (missing.length > 0) {
    console.error("!!!!!!!Missing required environment variables:");
    missing.forEach((variable) => console.error(`   - ${variable}`));
    process.exit(1);
}

console.log("Environment variables loaded successfully.");

module.exports = {
    PORT: process.env.PORT || 5000,

    DATABASE_URL: process.env.DATABASE_URL,

    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",

    FIREBASE: {
        PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    },

    CLOUDINARY: {
        CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        API_KEY: process.env.CLOUDINARY_API_KEY,
        API_SECRET: process.env.CLOUDINARY_API_SECRET,
    },
};