import * as admin from 'firebase-admin';
import serviceAccount from '../../firebase/atiani-firebase-adminsdk-25rzh-9816d96174.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
});

const db: FirebaseFirestore.Firestore = admin.firestore();

export default db;
