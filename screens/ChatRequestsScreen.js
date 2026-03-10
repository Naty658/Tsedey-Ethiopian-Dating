import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";




export default function ChatRequestsScreen() {
  const navigation = useNavigation();
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [reqs, setReqs] = useState([]);

    const _errToText = (e) => {
    const code = e?.code ? `code: ${e.code}` : "";
    const msg = e?.message ? `message: ${e.message}` : "";
    const name = e?.name ? `name: ${e.name}` : "";
    const where = e?._where ? `where: ${e._where}` : "";
    const native = e?.nativeErrorCode ? `nativeErrorCode: ${e.nativeErrorCode}` : "";

    const base = [name, code, native, where, msg].filter(Boolean).join("\n");
    if (base) return base;

    try {
      return JSON.stringify(e, Object.getOwnPropertyNames(e));
    } catch {
      return String(e);
    }
  };

  const _reportErr = (context, e, extra) => {
    const details = _errToText(e);
    console.log(`[${context}]`, details, extra || "");
    Alert.alert("Error", `${context}\n\n${details}${extra ? `\n\n${extra}` : ""}`);
  };


  useEffect(() => {
    let unsub = null;

        (async () => {
      try {
        const savedUid = auth().currentUser?.uid || (await AsyncStorage.getItem("uid"));
        if (!savedUid) { setLoading(false); return; }
        setUid(savedUid);

        unsub = firestore()
          .collection("users")
          .doc(savedUid)
          .collection("chatRequests")
          .where("status", "==", "pending")
          .onSnapshot(
            (snap) => {
              const list = snap.docs.map((d) => {
                const v = d.data();
                return {
                  id: d.id,                 // sender uid (MatchScreen uses doc(uid))
                  fromUid: v.fromUid || d.id,
                  fromName: v.fromName || "Someone",
                  fromPhoto: v.fromPhoto || "",
                  message: v.message || "",
                  status: v.status || "pending",
                  createdAt: v.createdAt || null,
                };
              });
              setReqs(list);
              setLoading(false);
            },
            (e) => {
              _reportErr("chatRequests onSnapshot failed", e, `uid=${savedUid}`);
              setLoading(false);
            }
          );
      } catch (e) {
        _reportErr("ChatRequestsScreen init failed", e);
        setLoading(false);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  const accept = async (r) => {
    if (!uid || !r?.fromUid) return;

    const chatId = [uid, r.fromUid].sort().join("_");
    const chatRef = firestore().collection("chats").doc(chatId);
    const members = [uid, r.fromUid].sort();


    const inboxReqRef = firestore()
      .collection("users").doc(uid)
      .collection("chatRequests").doc(r.fromUid);

    const outReqRef = firestore()
      .collection("users").doc(r.fromUid)
      .collection("sentChatRequests").doc(uid);

    try {
          await firestore().runTransaction(async (tx) => {
        let inboxSnap;
        try {
          inboxSnap = await tx.get(inboxReqRef);
        } catch (e) {
          e._where = "tx.get(inboxReqRef)";
          throw e;
        }

        if (!inboxSnap.exists) {
          const e = new Error("inbox request doc does not exist");
          e._where = "inboxReqRef missing";
          throw e;
        }

        try {
          tx.set(chatRef, {
  users: members,
  lastMessage: r.message || "Chat request accepted",
  lastUpdated: firestore.FieldValue.serverTimestamp(),
  createdAt: firestore.FieldValue.serverTimestamp(),
  fromRequest: true,
}, { merge: true });

        } catch (e) {
          e._where = "tx.set(chatRef)";
          throw e;
        }

        try {
         tx.set(
  outReqRef,
  { status: "accepted", acceptedAt: firestore.FieldValue.serverTimestamp() },
  { merge: true }
);


        } catch (e) {
          e._where = "tx.get/outReqRef or tx.update(outReqRef)";

          throw e;
        }

        try {
          tx.delete(inboxReqRef);
        } catch (e) {
          e._where = "tx.delete(inboxReqRef)";
          throw e;
        }
      });

      navigation.navigate("Chat", {
        chatId,
        currentUser: uid,
        otherUser: r.fromUid,
        otherUserName: r.fromName,
        otherUserPhoto: r.fromPhoto,
      });
        } catch (e) {
      _reportErr("accept() failed", e, `uid=${uid} fromUid=${r?.fromUid} chatId=${chatId}`);
    }

  };

  const decline = async (r) => {
    if (!uid || !r?.fromUid) return;

    const inboxReqRef = firestore()
      .collection("users").doc(uid)
      .collection("chatRequests").doc(r.fromUid);

    const outReqRef = firestore()
      .collection("users").doc(r.fromUid)
      .collection("sentChatRequests").doc(uid);

    try {
      await firestore().runTransaction(async (tx) => {
        const inboxSnap = await tx.get(inboxReqRef);
        if (!inboxSnap.exists) return;

const outSnap = await tx.get(outReqRef);
if (outSnap.exists) {
  tx.update(outReqRef, {
    status: "declined",
    declinedAt: firestore.FieldValue.serverTimestamp(),
  });
}
        tx.delete(inboxReqRef); // leaves “Chat requests”
      });
       } catch (e) {
      _reportErr("decline() failed", e, `uid=${uid} fromUid=${r?.fromUid}`);
    }

  };

  const renderItem = ({ item }) => (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.avatar}>
          {item.fromPhoto ? (
            <Image source={{ uri: item.fromPhoto }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarTxt}>{(item.fromName?.[0] || "?").toUpperCase()}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.topRow}>
            <Text style={s.name}>{item.fromName}</Text>
            <View style={s.pill}><Text style={s.pillTxt}>Pending</Text></View>
          </View>
          <Text style={s.msg} numberOfLines={2}>{item.message || "Wants to chat"}</Text>
        </View>
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.btnGhost} onPress={() => decline(item)} activeOpacity={0.9}>
          <Text style={s.btnGhostTxt}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnPrimary} onPress={() => accept(item)} activeOpacity={0.9}>
          <Text style={s.btnPrimaryTxt}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading requests…</Text>
      </View>
    );
  }
  return (
    <SafeAreaView style={s.screen}>
           <View style={s.header}>
  <Text style={s.title}>Chat requests</Text>


        <TouchableOpacity
  style={s.closeBtn}
  onPress={() => navigation.goBack()}
  activeOpacity={0.8}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Text style={s.closeBtnTxt}>✕</Text>
  <Text style={s.closeLbl}>Close</Text>
</TouchableOpacity>

      </View>


      {reqs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No pending requests</Text>
          <Text style={s.emptySub}>When someone sends a request, it will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={reqs}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}

        />
      )}

      <TouchableOpacity
  style={s.closeFloating}
  onPress={() => navigation.goBack()}
  activeOpacity={0.85}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Text style={s.closeFloatingTxt}>✕</Text>
  <Text style={s.closeFloatingLbl}>Close</Text>
</TouchableOpacity>

    </SafeAreaView>
  );

}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f0ff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: "800" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { marginTop: 6, color: "#666", textAlign: "center" },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 12, elevation: 3 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },

  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#faf8ff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(103,58,183,0.18)" },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarTxt: { fontSize: 18, fontWeight: "800", color: "#673ab7" },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 15, fontWeight: "800", color: "#222" },
  msg: { marginTop: 4, color: "#666" },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,61,127,0.12)", borderWidth: 1, borderColor: "rgba(255,61,127,0.28)" },
  pillTxt: { fontWeight: "900", color: "#ff3d7f", fontSize: 12 },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnGhost: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(17,24,39,0.15)", alignItems: "center" },
  btnGhostTxt: { fontWeight: "800", color: "#111827" },
  btnPrimary: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#673ab7", alignItems: "center" },
  btnPrimaryTxt: { fontWeight: "900", color: "#fff" },
   closeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.06)" },
  closeBtnTxt: { fontSize: 22, fontWeight: "900", color: "#111827", lineHeight: 22 },
  header: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 6,
},

closeFloating: {
  position: "absolute",
  bottom: 18,
  alignSelf: "center",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: "rgba(103,58,183,0.12)",
  borderWidth: 1,
  borderColor: "rgba(103,58,183,0.35)",
  shadowColor: "#673ab7",
  shadowOpacity: 0.45,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
},
closeFloatingTxt: { fontSize: 18, fontWeight: "900", color: "#111827", lineHeight: 18 },
closeFloatingLbl: { fontSize: 12, fontWeight: "900", color: "#111827" },



});
