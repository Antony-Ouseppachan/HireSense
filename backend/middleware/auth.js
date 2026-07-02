const admin = require("../config/firebase");

async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing.",
            });
        }

        const idToken = authHeader.split("Bearer ")[1];

        const decodedToken = await admin.auth().verifyIdToken(idToken);

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || "",
            picture: decodedToken.picture || "",
            emailVerified: decodedToken.email_verified || false,
        };

        next();
    } catch (error) {
        console.error("!!!!!Firebase Authentication Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token.",
        });
    }
}

module.exports = {
    authenticateUser,
};