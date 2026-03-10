import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";


export default function ProfileViewScreen({ route, navigation }) {
  const user = route?.params?.user;
  const otherUid = user?.uid || user?.otherUid;      // ✅ supports both shapes
const otherName = user?.name || user?.otherName || "User";
const otherPhoto = user?.photo || user?.otherPhoto || "";


  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 18, color: '#555' }}>User data not found.</Text>
      </View>
    );
  }

 const handleChat = async () => {
  try {
   const currentUser = auth().currentUser;
if (!currentUser) return alert("Please log in first.");
const currentUid = currentUser.uid;


    const otherUid = user?.uid || user?.otherUid;
    if (!otherUid) return alert("User UID missing.");

    const chatId =
      currentUid < otherUid ? `${currentUid}_${otherUid}` : `${otherUid}_${currentUid}`;

   const ts = firestore.FieldValue.serverTimestamp();

// ✅ ChatScreen uses "threads"
await firestore().collection("threads").doc(chatId).set(
  {
    id: chatId,
    users: [currentUid, otherUid].sort(),
    createdAt: ts,
    updatedAt: ts,
  },
  { merge: true }
);

// ✅ ChatScreen also reads chatStatus
await firestore().collection("chatStatus").doc(chatId).set(
  {
    users: [currentUid, otherUid].sort(),
    blockedByUid: [],
  },
  { merge: true }
);


    navigation.navigate("Chat", {
      chatId,
      currentUser: currentUid,
      otherUser: otherUid,
      otherUserName: user?.name || user?.otherName || "User",
      otherUserPhoto: user?.photo || user?.otherPhoto || "",
    });
  } catch (e) {
    console.log("handleChat error:", e);
    alert("Failed to open chat.");
  }
};


return (
  <ScrollView
    contentContainerStyle={styles.container}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.profileCard}>
      {user.photo ? (
        <Image source={{ uri: user.photo }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {user.name?.[0]?.toUpperCase() || "?"}
          </Text>
        </View>
      )}

      <Text style={styles.name}>{user.name || "Unknown User"}</Text>

      {(user.age || user.gender) && (
        <Text style={styles.sub}>
          {user.age ? `${user.age} yrs` : ""}{" "}
          {user.gender ? `• ${user.gender}` : ""}
        </Text>
      )}

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
    </View>

    <Text style={styles.sectionTitle}>Profile details</Text>

    <View style={styles.infoBox}>
      {user.from && <Text style={styles.info}>🏡 From: {user.from}</Text>}
      {user.city && <Text style={styles.info}>📍 Lives in: {user.city}</Text>}
      {user.religion && (
        <Text style={styles.info}>🙏 Religion: {user.religion}</Text>
      )}
      {user.languages && (
        <Text style={styles.info}>🗣 Languages: {user.languages}</Text>
      )}
      {user.hobby && <Text style={styles.info}>🎯 Hobby: {user.hobby}</Text>}
      {user.diet && <Text style={styles.info}>🥗 Diet: {user.diet}</Text>}
      {user.education && (
        <Text style={styles.info}>🎓 Education: {user.education}</Text>
      )}
      {user.occupation && (
        <Text style={styles.info}>💼 Occupation: {user.occupation}</Text>
      )}
      {user.smoke && (
        <Text style={styles.info}>🚬 Smokes: {user.smoke}</Text>
      )}
      {user.drink && (
        <Text style={styles.info}>🍷 Drinks: {user.drink}</Text>
      )}
      {user.lookingFor && (
        <Text style={styles.info}>💖 Looking For: {user.lookingFor}</Text>
      )}
      {user.partnerLocation && (
        <Text style={styles.info}>
          🌍 Prefers Partner Location: {user.partnerLocation}
        </Text>
      )}
    </View>

{/* ⬇️ Chat button */}
<TouchableOpacity style={styles.chatButton} onPress={handleChat}>
  <Text
    style={styles.chatText}
    numberOfLines={1}
    ellipsizeMode="tail"
  >
    💬 Chat with {user.name || "User"}
  </Text>
</TouchableOpacity>
  </ScrollView>
);
}
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f3f0ff",
    paddingBottom: 40,
    alignItems: "stretch",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f0ff",
  },

  profileCard: {
    backgroundColor: "#fff9fb",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  image: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(233,30,99,0.55)",
  },
  placeholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#f5e9ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(233,30,99,0.25)",
  },
  placeholderText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#e91e63",
  },

  name: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
    color: "#1f1233",
  },
  sub: {
    fontSize: 14,
    color: "#7a6a9e",
    marginTop: 4,
    marginBottom: 8,
  },
  bio: {
    fontSize: 15,
    color: "#4a3e68",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 10,
  },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 6,
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "600",
    color: "#7a6a9e",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoBox: {
    alignSelf: "stretch",
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  info: {
    fontSize: 14,
    color: "#4a3e68",
    marginBottom: 8,
  },

  chatButton: {
    marginTop: 24,
    backgroundColor: "#e91e63",
    paddingVertical: 14,
    borderRadius: 999,
    alignSelf: "stretch",
    alignItems: "center",
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 5,
  },
  // ⬇️ Update chatText style like this (small tweak):
chatText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 15,   // a bit smaller so it fits nicely
},
});
