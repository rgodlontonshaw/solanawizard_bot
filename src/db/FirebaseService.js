const admin = require('firebase-admin');
const serviceAccount = require('../../firebase/atiani-firebase-adminsdk-25rzh-9816d96174.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = db;
