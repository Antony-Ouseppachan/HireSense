const db = require("../config/database");

/**
 * Login or Register User
 * Called after Firebase token has been verified
 */
const login = async (req, res) => {
    try {
        const {
            uid,
            email,
            name,
            picture,
            emailVerified,
        } = req.user;

        // Check if user already exists
        const existingUser = await db.query(
            `
            SELECT *
            FROM users
            WHERE firebase_uid = $1
            `,
            [uid]
        );

        let user;

        if (existingUser.rows.length === 0) {
            // First login → Create user
            const newUser = await db.query(
                `
                INSERT INTO users
                (
                    firebase_uid,
                    email,
                    full_name,
                    profile_picture_url,
                    is_verified,
                    role
                )
                VALUES
                ($1, $2, $3, $4, $5, 'candidate')
                RETURNING *
                `,
                [
                    uid,
                    email,
                    name || "New User",
                    picture || null,
                    emailVerified || false,
                ]
            );

            user = newUser.rows[0];

            console.log(`✅ New user created: ${email}`);
        } else {
            // Existing user → Update latest info
            const updatedUser = await db.query(
                `
                UPDATE users
                SET
                    full_name = $1,
                    profile_picture_url = $2,
                    is_verified = $3,
                    last_login = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE firebase_uid = $4
                RETURNING *
                `,
                [
                    name || existingUser.rows[0].full_name,
                    picture || existingUser.rows[0].profile_picture_url,
                    emailVerified,
                    uid,
                ]
            );

            user = updatedUser.rows[0];

            console.log(`🔄 User logged in: ${email}`);
        }

        res.status(200).json({
            success: true,
            message: "Authentication successful.",
            user,
        });

    } catch (error) {
        console.error("Authentication Error:", error);

        res.status(500).json({
            success: false,
            message: "Authentication failed.",
        });
    }
};

/**
 * Get Current Logged-in User
 */
const getCurrentUser = async (req, res) => {
    try {
        const result = await db.query(
            `
            SELECT *
            FROM users
            WHERE firebase_uid = $1
            `,
            [req.user.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        res.status(200).json({
            success: true,
            user: result.rows[0],
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch user.",
        });
    }
};

/**
 * Check if user email is registered in Postgres database
 */
const checkEmail = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email query parameter is required."
            });
        }
        const result = await db.query(
            `
            SELECT id
            FROM users
            WHERE email = $1
            LIMIT 1
            `,
            [email.toLowerCase().trim()]
        );
        res.status(200).json({
            success: true,
            exists: result.rows.length > 0
        });
    } catch (error) {
        console.error("Check Email Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check email."
        });
    }
};

module.exports = {
    login,
    getCurrentUser,
    checkEmail,
};