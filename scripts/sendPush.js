// sendPush.js

const admin = require('firebase-admin');
const fetch = require('node-fetch'); // npm install node-fetch

// put your downloaded Firebase service account file here
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function sendPushToAllUsers() {
  const snapshot = await db.collection('users').get();

  const messages = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const token = data.expoPushToken;
    if (token) {
      messages.push({
        to: token,
        sound: 'default',
        title: 'Lots of beautiful people out there',
        body: 'What are you going to do about it? 😉',
        data: { type: 'campaign' },
      });
    }
  });

  if (!messages.length) {
    console.log('No tokens found');
    return;
  }

  // Expo allows sending in chunks (array of messages)
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const json = await res.json();
  console.log('Expo response:', JSON.stringify(json, null, 2));
}

sendPushToAllUsers()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
