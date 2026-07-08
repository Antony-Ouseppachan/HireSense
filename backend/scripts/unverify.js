const admin = require("../config/firebase");

const EMAIL_TO_UNVERIFY = "antony230710@gmail.com";

async function run() {
  const user = await admin.auth().getUserByEmail(EMAIL_TO_UNVERIFY);
  await admin.auth().updateUser(user.uid, { emailVerified: false });
  console.log(`Set emailVerified=false for ${EMAIL_TO_UNVERIFY}`);
}

run().catch(console.error);

//node scripts/unverify.js