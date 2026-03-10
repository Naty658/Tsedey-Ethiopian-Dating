import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";


export default function ConnectionsScreen() {
  const navigation = useNavigation();
  const [matches, setMatches] = useState([]);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const db = React.useMemo(() => firestore(), []);
const sourceMapsRef = React.useRef({ uid: new Map(), email: new Map() });


useFocusEffect(
  React.useCallback(() => {
    let mounted = true;
    let unsub = null;

    const start = async () => {
      setLoading(true);

      try {
        const savedUid = await AsyncStorage.getItem("uid");
        const savedEmail = await AsyncStorage.getItem("email");

       if (!savedUid) {
  if (mounted) setLoading(false);
  return;
}

// reset caches each time screen focuses (prevents stale merge after logout/rejoin)
sourceMapsRef.current = { uid: new Map(), email: new Map() };


        if (!mounted) return;
        setUid(savedUid);
        setEmail(savedEmail);

      const q1 = db.collection("matches").where("users", "array-contains", savedUid);
const q2 = savedEmail
  ? db.collection("matches").where("users", "array-contains", savedEmail)
  : null;


const buildRows = async (snap) => {
  const rows = await Promise.all(
    snap.docs.map(async (m) => {
      const data = m.data();
      if (!Array.isArray(data?.users)) return null;

      const otherKey = data.users.find((u) => u !== savedUid && u !== savedEmail);
      if (!otherKey) return null;

      let otherProfile = null;

      // (faster) try doc id first
      const byId = await db.collection("profiles").doc(otherKey).get();
      if (byId.exists) otherProfile = byId.data();
      else {
        const byUid = await db.collection("profiles").where("uid", "==", otherKey).limit(1).get();
        if (!byUid.empty) otherProfile = byUid.docs[0].data();
        else {
          const byEmail = await db.collection("profiles").where("email", "==", otherKey).limit(1).get();
          if (!byEmail.empty) otherProfile = byEmail.docs[0].data();
        }
      }

      return {
        id: m.id,
        otherUid: otherProfile?.uid || otherKey,
        otherEmail: otherProfile?.email || "unknown",
        otherName: otherProfile?.name || "Unknown",
        otherPhoto: otherProfile?.photo || null,
        otherProfile,
      };
    })
  );

  return rows.filter(Boolean);
};

const applySnapshot = async (source, snap) => {
  const rows = await buildRows(snap);
  const map = new Map(rows.map((r) => [r.id, r]));
  sourceMapsRef.current[source] = map;

  const merged = new Map([
    ...sourceMapsRef.current.uid.entries(),
    ...sourceMapsRef.current.email.entries(),
  ]);

  if (!mounted) return;
  setMatches(Array.from(merged.values()));
  setLoading(false);
};

const unsub1 = q1.onSnapshot(
  (snap) => applySnapshot("uid", snap),
  (e) => {
    console.log("Error loading connections (uid):", e);
    if (mounted) setLoading(false);
  }
);

let unsub2 = null;
if (q2) {
  unsub2 = q2.onSnapshot(
    (snap) => applySnapshot("email", snap),
    (e) => {
      console.log("Error loading connections (email):", e);
      if (mounted) setLoading(false);
    }
  );
}


unsub = () => {
  unsub1 && unsub1();
  unsub2 && unsub2();
};

          
      } catch (e) {
        console.log("Error loading connections:", e);
        if (mounted) setLoading(false);
      }
    };

    start();

    return () => {
      mounted = false;
      if (typeof unsub === "function") unsub();
    };
  }, [db])
);



  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={{ marginTop: 8, color: '#7a6a9e', fontSize: 14 }}> Loading connections...</Text>
      </View>
    );
  }
// 🔹 1) Replace the inside of your return(...) with this:
return (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Your Connections</Text>
      <Text style={styles.headerSubtitle}>People who liked you back</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{matches.length} active connections</Text>
      </View>
    </View>

    {matches.length === 0 ? (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No connections yet</Text>
        <Text style={styles.emptyText}>
          Start swiping and your mutual likes will appear here.
        </Text>
      </View>
    ) : (
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate("ProfileView", { user: item.otherProfile || item })







            }
          >
            {item.otherPhoto ? (
              <Image source={{ uri: item.otherPhoto }} style={styles.photo} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderInitial}>
                  {(item.otherName?.[0] || "?").toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.name}>{item.otherName}</Text>
              <Text style={styles.tag}>Tap to view profile</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    )}
  </View>
);}

// 🔹 2) Replace / add these styles:
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f0ff",
    paddingTop: 60,
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f1233",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#7a6a9e",
  },
  badge: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(233,30,99,0.10)",
    borderWidth: 1,
    borderColor: "rgba(233,30,99,0.45)",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e91e63",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9fb",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "rgba(233,30,99,0.45)",
  },
  placeholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#faf8ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "rgba(233,30,99,0.25)",
  },
  placeholderInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e91e63",
  },
  infoBox: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f1233",
  },
  tag: {
    marginTop: 4,
    fontSize: 12,
    color: "#e91e63",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(233,30,99,0.06)",
    alignSelf: "flex-start",
  },

  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
  },
});
