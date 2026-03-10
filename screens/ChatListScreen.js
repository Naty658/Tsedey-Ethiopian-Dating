import React, { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import { Modal } from "react-native";
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
const isPremiumUser = (u) => {
  const untilTs = u?.premiumUntil || u?.fromPremiumUntil;
  const until =
    untilTs?.toDate ? untilTs.toDate() :
    untilTs ? new Date(untilTs) :
    null;

  const active =
    (u?.isPremium === true || u?.premium === true || u?.premiumUser === true || u?.pro === true) &&
    (!until || until.getTime() > Date.now());

  return Boolean(active);
};



export default function ChatListScreen() {
  const navigation = useNavigation(); // ✅ use hook instead of prop
  const [chats, setChats] = useState([]);
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuItem, setMenuItem] = useState(null);
  const [reqCount, setReqCount] = useState(0);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

const REPORT_REASONS = [
  "Spam / scam",
  "Harassment / abusive",
  "Inappropriate content",
  "Fake profile",
];

const deleteChatEverywhere = async (item) => {
  if (!item || !uid) return;

  try {
    // ✅ remove from THIS screen source (users/{uid}/inbox)
    if (item.inboxDocId) {
      await firestore()
        .collection("users")
        .doc(uid)
        .collection("inbox")
        .doc(item.inboxDocId)
        .delete();
    }

    // optional: also mark hidden on thread (don't fail delete if this fails)
    if (item.id) {
      try {
        await firestore()
          .collection("threads")
          .doc(item.id)
          .update({
            hiddenFor: firestore.FieldValue.arrayUnion(uid),
          });
      } catch (e) {
        console.log("thread hiddenFor update skipped:", e?.message || e);
      }
    }

    setChats((prev) => prev.filter((c) => c.inboxDocId !== item.inboxDocId));
    setMenuItem(null);
  } catch (e) {
    console.log("deleteChat error:", e);
    Alert.alert("Delete failed", e?.message || "Could not delete chat.");
  }
};

const submitReport = async (reason) => {
  try {
    await firestore().collection("reports").add({
  chatId: reportTarget?.id,
  reportedUid: reportTarget?.otherUser,   // optional but matches your admin schema better
  reporterUid: uid,                       // ✅ rule expects this
  reason,
  createdAt: firestore.FieldValue.serverTimestamp(),
});

    console.log("Report saved:", reason);
    Alert.alert("Reported", "Thanks, we received your report.");
  } catch (e) {
    console.log("Report error", e);
    Alert.alert("Report failed", e?.message || "Try again.");
  } finally {
    setReportModalVisible(false);
    setMenuItem(null);
    setReportTarget(null);

  }
};


const fetchChats = React.useCallback(async () => {
  setLoading(true);

  try {
    const savedEmail = await AsyncStorage.getItem('email');
    const savedUid = auth().currentUser?.uid || (await AsyncStorage.getItem('uid'));

    setEmail(savedEmail || '');
    setUid(savedUid || '');

    if (!savedUid) {
      setChats([]);
      return;
    }

   const snapshot = await firestore()
  .collection("users")
  .doc(savedUid)
  .collection("inbox")
  .orderBy("lastAt", "desc")
  .get();


    const chatList = [];

   for (const docSnap of snapshot.docs) {
  const data = docSnap.data();

  const otherUser = data.otherUid;
  if (!otherUser) continue;

   const presenceSnap = await firestore()
    .collection("presence")
    .doc(otherUser)
    .get();

  const isOnline = presenceSnap.exists && presenceSnap.data()?.online === true;

 const otherSnap = await firestore().collection("users").doc(otherUser).get();
const otherData = otherSnap.exists ? otherSnap.data() : null;

const profSnap = await firestore().collection("profiles").doc(otherUser).get();
const profData = profSnap.exists ? profSnap.data() : null;

// merge: prefer profiles fields when present
const mergedOther = { ...(otherData || {}), ...(profData || {}) };

const otherIsPremium = mergedOther ? isPremiumUser(mergedOther) : false;

// treat "UID-looking" strings as not-a-name
const looksLikeUid = (s) => typeof s === "string" && s.length >= 20 && !s.includes(" ");
const isBlank = (v) => v == null || (typeof v === "string" && v.trim() === "");

const isPlaceholderName = (s) => {
  if (isBlank(s)) return true;
  const t = String(s).trim();
  if (looksLikeUid(t)) return true;
  const low = t.toLowerCase();
  return low === "user" || low === "unknown" || low === "anonymous";
};

const cleanPhoto = (p) =>
  (typeof p === "string" && p.trim() && p !== "null" && p !== "undefined") ? p.trim() : null;

const profileName =
  mergedOther?.name ||
  mergedOther?.fullName ||
  mergedOther?.displayName ||
  mergedOther?.username ||
  (mergedOther?.firstName && mergedOther?.lastName ? `${mergedOther.firstName} ${mergedOther.lastName}` : "") ||
  mergedOther?.firstName ||
  "";

const profilePhoto = cleanPhoto(
  mergedOther?.photoURL || mergedOther?.photo || mergedOther?.avatar
);

const resolvedName = !isPlaceholderName(profileName)
  ? profileName
  : (!isPlaceholderName(data.otherName) ? data.otherName : "User");

const resolvedPhoto =
  profilePhoto || cleanPhoto(data.otherPhoto) || null;


chatList.push({
  id: data.threadId || docSnap.id,   // chat/thread id you navigate with
  inboxDocId: docSnap.id,           // ✅ always the inbox row id
  otherUser,
  otherUserName: resolvedName,
  otherUserPhoto: resolvedPhoto,
  lastMessage: data.lastMessage || "No new message yet",
  lastUpdated: data.lastAt || null,
  unreadCount: data.unreadCount || 0,
  isOnline,
  otherIsPremium,
});


}


    chatList.sort((a, b) => {
      const at = a.lastUpdated?.toMillis?.() || 0;
      const bt = b.lastUpdated?.toMillis?.() || 0;
      return bt - at;
    });

    setChats(chatList);
  } catch (e) {
    console.log('fetchChats error:', e);
    setChats([]);
  } finally {
    setLoading(false);
  }
}, []);

useFocusEffect(
  React.useCallback(() => {
    fetchChats();
  }, [fetchChats])
);

useEffect(() => {
  if (!uid) {
    setReqCount(0)
    return;
  }

 
  const unsub = firestore()
    .collection("users")
    .doc(uid)
    .collection("chatRequests")
    .where("status", "==", "pending")
    .onSnapshot(
      (snap) => setReqCount(snap.size),
      (e) => console.log("chatRequests listener error:", e)
    );

  return () => unsub();
}, [uid]);


const renderItem = ({ item }) => {
  const isGold = !!item.otherIsPremium; // premium always gold

  return (
    <TouchableOpacity
      style={[styles.chatCard, isGold && styles.chatCardGold]}

    onPress={async () => {
  if (openMenu === item.id) return;

  // ✅ mark as read immediately on open
  if (uid && item.inboxDocId) {
    await firestore()
      .collection("users")
      .doc(uid)
      .collection("inbox")
      .doc(item.inboxDocId)
      .set({ unreadCount: 0 }, { merge: true });

    // optional: instant UI update without waiting for refetch
    setChats((prev) =>
      prev.map((c) => (c.inboxDocId === item.inboxDocId ? { ...c, unreadCount: 0 } : c))
    );
  }

  navigation.navigate("Chat", {
    chatId: item.id,
    currentUser: uid,
    otherUser: item.otherUser,
    otherUserName: item.otherUserName,
    otherUserPhoto: item.otherUserPhoto,
  });
}}

  >
      <View style={[styles.photoWrapper, isGold && styles.photoWrapperGold]}>

                {item.otherUserPhoto ? (
        <Image source={{ uri: item.otherUserPhoto }} style={styles.photo} />
      ) : (
          <Text style={[styles.placeholderInitial, isGold && styles.goldText]}>

          {(item.otherUserName?.[0] || '?').toUpperCase()}
        </Text>
      )}
      {item.isOnline ? (
        <View style={styles.onlineDot} />
      ) : (
        <View style={styles.offlineDot} />
      )}

    </View>

    <View style={styles.chatContent}>
      <View style={styles.chatTextBox}>
       <Text style={[styles.name, isGold && styles.goldText]}>{item.otherUserName}</Text>
<Text style={[styles.message, isGold && styles.goldSubText]} numberOfLines={1}>

          {item.lastMessage}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => setMenuItem(item)}
        style={styles.moreButton}
      >
        <MaterialIcons name="more-vert" size={22} color="#888" />
      </TouchableOpacity>
    </View>
    </TouchableOpacity>
  );
};



 if (loading) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#673ab7" />
      <Text style={styles.loadingText}>Loading chats...</Text>
    </View>
  );
}

return (
  <SafeAreaView style={styles.screen}>
   <LinearGradient
  colors={['rgba(255,215,0,0.28)', 'rgba(103,58,183,0.10)']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.premiumBanner}
>
  <View style={styles.premiumBannerTopRow}>
    <View style={styles.premiumPill}>
      <MaterialIcons name="workspace-premium" size={16} color="#8a6a00" />
      <Text style={styles.premiumPillText}>GOLD</Text>
    </View>
    <Text style={styles.premiumBannerTitle}>Golden chats deserve priority</Text>
  </View>

  <Text style={styles.premiumBannerText}>
    ✨💛 Golden users paid just to talk to you — maybe give them a peek 👀 and see what they’re about 😉

  </Text>
</LinearGradient>


  <TouchableOpacity
  style={styles.requestsRow}
  onPress={() => navigation.navigate("ChatRequests")}
  activeOpacity={0.9}
>
  <View style={styles.requestsLeft}>
    <MaterialIcons name="inbox" size={22} color="#673ab7" />
    <Text style={styles.requestsText}>Chat requests</Text>
  </View>

  {reqCount > 0 && (
    <View style={styles.reqBadge}>
      <Text style={styles.reqBadgeText}>{reqCount}</Text>
    </View>
  )}
</TouchableOpacity>

    {chats.length === 0 ? (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No chats yet</Text>
        <Text style={styles.emptyText}>
          Start matching and your conversations will appear here.
        </Text>
      </View>
    ) : (
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    )}


     <Modal
  transparent
  visible={!!menuItem}
  animationType="fade"
  onRequestClose={() => setMenuItem(null)}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={() => setMenuItem(null)}
    style={{
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center'
    }}
  >
    <View
      style={{
        width: 220,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12
      }}
      onStartShouldSetResponder={() => true} // ⬅ stops closing when tapping inside
    >
   

   <TouchableOpacity
  onPress={() => {
    const itemToDelete = menuItem;
    Alert.alert(
      "Delete chat?",
      "This will hide this chat for you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteChatEverywhere(itemToDelete),
        },
      ]
    );
  }}
  style={{ paddingVertical: 10 }}
>
  <Text style={{ color: "#d32f2f", fontWeight: "700" }}>Delete chat</Text>
</TouchableOpacity>

<View style={{ height: 1, backgroundColor: "#eee", marginVertical: 6 }} />
<TouchableOpacity
  onPress={() => {
  setReportTarget(menuItem);
  setMenuItem(null);
  setReportModalVisible(true);
}}
  style={{ paddingVertical: 10 }}
>
  <Text>Report</Text>
</TouchableOpacity>


  </View>
      </TouchableOpacity>
    </Modal>


    <Modal
  transparent
  visible={reportModalVisible}
  animationType="fade"
  onRequestClose={() => setReportModalVisible(false)}
>
  <TouchableOpacity
    activeOpacity={1}
    onPress={() => setReportModalVisible(false)}
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    }}
  >
    <View
      style={{
        width: "100%",
        maxWidth: 320,
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
      }}
      onStartShouldSetResponder={() => true}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#222", marginBottom: 6 }}>
        Report user
      </Text>
      <Text style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
        Select a reason
      </Text>

      {REPORT_REASONS.map((reason) => (
        <TouchableOpacity
          key={reason}
          onPress={() => submitReport(reason)}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: "#f7f5ff",
            marginBottom: 8,
            borderWidth: 1,
            borderColor: "rgba(103,58,183,0.12)",
          }}
        >
          <Text style={{ color: "#222", fontWeight: "600" }}>{reason}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={() => setReportModalVisible(false)}
        style={{ paddingVertical: 10, alignItems: "center", marginTop: 2 }}
      >
        <Text style={{ color: "#673ab7", fontWeight: "700" }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>

  </SafeAreaView>
);
}
const styles = StyleSheet.create({
  // screen & loading
  screen: {
    flex: 1,
    backgroundColor: '#f3f0ff',
  },
  loading: {
    flex: 1,
    backgroundColor: '#f3f0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },

  // header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#222',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#777',
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(103,58,183,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.25)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#673ab7',
  },

  // list
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },

  // chat card
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  photoWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(103,58,183,0.35)',
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  placeholderInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#673ab7',
  },
   onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  offlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
    borderWidth: 2,
    borderColor: '#ffffff',
  },


  chatContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTextBox: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  message: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  // empty state
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },

  requestsRow: {
  marginTop: 12,
  marginHorizontal: 20,
  padding: 14,
  borderRadius: 18,
  backgroundColor: "#fff",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
},
requestsLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
requestsText: { fontSize: 15, fontWeight: "700", color: "#222" },
reqBadge: {
  minWidth: 26,
  paddingHorizontal: 8,
  height: 26,
  borderRadius: 13,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(103,58,183,0.12)",
  borderWidth: 1,
  borderColor: "rgba(103,58,183,0.25)",
},
reqBadgeText: { fontSize: 12, fontWeight: "800", color: "#673ab7" },
chatCardGold: {
  borderWidth: 1,
  borderColor: "#FFD700",
  backgroundColor: "rgba(255,215,0,0.10)",
},
photoWrapperGold: {
  borderColor: "rgba(255,215,0,0.75)",
},
goldText: {
  color: "#B8860B",
},
goldSubText: {
  color: "#8a6a00",
},

premiumBanner: {
  marginTop: 10,
  marginHorizontal: 20,
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,215,0,0.55)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
},
premiumBannerTopRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 6,
},
premiumPill: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  backgroundColor: 'rgba(255,215,0,0.22)',
  borderWidth: 1,
  borderColor: 'rgba(255,215,0,0.65)',
},
premiumPillText: {
  fontSize: 12,
  fontWeight: '900',
  letterSpacing: 0.7,
  color: '#8a6a00',
},
premiumBannerTitle: {
  flex: 1,
  fontSize: 15,
  fontWeight: '800',
  color: '#2b1b4f',
},
premiumBannerText: {
  fontSize: 13,
  lineHeight: 18,
  color: '#3a2a5a',
  fontWeight: '600',
},


});
