const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

(async () => {
  const snap = await db.collection("profiles").get();
  snap.forEach(doc => {
    doc.ref.update({ hidden: false });
  });
  console.log("done");
})();
