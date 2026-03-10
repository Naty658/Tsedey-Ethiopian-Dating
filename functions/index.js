const {setGlobalOptions} = require("firebase-functions/v2/options");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const {onCall, HttpsError} = require("firebase-functions/v2/https");


admin.initializeApp();
setGlobalOptions({maxInstances: 10});

exports.sendDailySwipeReminder = onSchedule("every 1 minutes", async () => {

  const snap = await admin
    .firestore()
    .collection("users")
    .where("expoPushToken", "!=", "")

    .get();

  if (snap.empty) return;
  console.log("push users:", snap.size);



  const messages = snap.docs
  .map((doc) => {
    console.log("token:", doc.data().expoPushToken, "uid:", doc.id);

    return {
      to: doc.data().expoPushToken,
      sound: "default",
      title: "Login and swipe new comers",
      body: "New people joined, come check them out!",
    };
  })
  .filter((m) => typeof m.to === "string" && m.to.startsWith("ExponentPushToken["));
  
if (!messages.length) return;
const chunk = messages.slice(0, 100);




 

 for (let i = 0; i < messages.length; i += 100) {
  const chunk = messages.slice(i, i + 100);

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-encoding": "gzip, deflate",
    },
    body: JSON.stringify(chunk),
  });

  console.log("EXPO_STATUS", res.status, "batch", i, "to", i + chunk.length);
  const text = await res.text();
  console.log("EXPO_RAW", text);
}




});

async function deleteCollection(db, path, batchSize = 400) {
  const colRef = db.collection(path);

  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) return;


    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

exports.deleteChatEverywhere = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const chatId = request.data?.chatId;
  if (!chatId || typeof chatId !== "string") {
    throw new HttpsError("invalid-argument", "chatId required.");
  }

  const db = admin.firestore();
  const chatRef = db.collection("chats").doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) return {ok: true};

  const users = chatSnap.data()?.users || [];
  if (!Array.isArray(users) || !users.includes(uid)) {
    throw new HttpsError("permission-denied", "Not a chat member.");
  }

  // 1) delete messages subcollection
  await deleteCollection(db, `chats/${chatId}/messages`, 400);

  // 2) delete chatStatus doc (if exists)
  await db.collection("chatStatus").doc(chatId).delete().catch(() => null);

  // 3) delete userChats threads (if you use them)
  for (const u of users) {
    await db.doc(`userChats/${u}/threads/${chatId}`).delete().catch(() => null);
  }

  // 4) delete match doc (if you use deterministic matchId = "uidA_uidB")
  if (users.length === 2) {
    const matchId = [...users].sort().join("_");
    await db.collection("matches").doc(matchId).delete().catch(() => null);
  }

  // 5) delete chat doc
  await chatRef.delete();

  return {ok: true};
});
