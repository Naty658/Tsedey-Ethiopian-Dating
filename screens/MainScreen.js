import React, { useState, useEffect } from 'react';

//import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
//import LinearGradient from 'react-native-linear-gradient';
import { LinearGradient } from 'expo-linear-gradient';

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";




import MatchScreen from './MatchScreen';
import ConnectionsScreen from './ConnectionsScreen';
import ChatListScreen from './ChatListScreen';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';
import NotificationsScreen from './NotificationsScreen';

//import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
//import MaskedView from '@react-native-masked-view/masked-view';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
//import MaskedView from '@react-native-masked-view/expo';
import MaskedView from '@react-native-masked-view/masked-view';
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";




const isPremiumNotif = (n) => {
  const untilTs = n?.fromPremiumUntil;
  const until =
    untilTs?.toDate ? untilTs.toDate() :
    untilTs ? new Date(untilTs) :
    null;

  const activeFromPremium =
    n?.fromIsPremium === true && (!until || until.getTime() > Date.now());

  return Boolean(
    activeFromPremium ||
      n?.fromPremium ||
      n?.senderIsPremium ||
      n?.isPremium ||
      n?.premium ||
      n?.premiumUser
  );
};


export default function MainScreen() {
  const [active, setActive] = useState('Match');
  const [hasPremiumNotif, setHasPremiumNotif] = useState(false);
  const [uid, setUid] = useState(null);

  const [unreadChats, setUnreadChats] = useState(0);
  const [premiumChatKey, setPremiumChatKey] = useState(null);
const [seenPremiumChatKey, setSeenPremiumChatKey] = useState(null);




const userEmail = auth().currentUser?.email || '';

const toMs = (ts) => {
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  return d ? d.getTime() : 0;
};

const isPremiumChat = (c) => {
  // reuse your premium detector, plus common chat flags if you have them
  return isPremiumNotif(c) || Boolean(c?.otherUserIsPremium || c?.peerIsPremium || c?.isPremiumUser);
};

useEffect(() => {
  const unsub = auth().onAuthStateChanged((u) => setUid(u?.uid ?? null));
  return unsub;
}, []);


useEffect(() => {
  if (active === "Chats" && premiumChatKey) {
    setSeenPremiumChatKey(premiumChatKey);
  }
}, [active, premiumChatKey]);


  async function saveExpoTokenForCurrentUser() {
  const uid = auth().currentUser?.uid;

  if (!uid) return;
  if (!Device.isDevice) return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("MY_EXPO_TOKEN:", token, "uid:", uid);

await firestore().collection("users").doc(uid).set({ expoPushToken: token }, { merge: true });

}

useEffect(() => {
  if (!uid) return;
  saveExpoTokenForCurrentUser();
}, [uid]);

useEffect(() => {
  if (!uid) {
    setUnreadChats(0);
    setPremiumChatKey(null);
    setSeenPremiumChatKey(null);
    return;
  }

  const unsub = firestore()
    .collection("users")
    .doc(uid)
    .collection("inbox")
    .onSnapshot(
      (snap) => {
        let total = 0;

        // premium-unread signature: newest premium unread message timestamp
        let newestPremiumUnreadMs = 0;

        snap.forEach((d) => {
          const data = d.data() || {};
          const c = Number(data?.unreadCount || 0);

          if (c > 0) total += 1; // unchanged: 1 per chat/person

          if (c > 0 && isPremiumChat(data)) {
            const ms = Math.max(
              toMs(data?.lastMessageAt),
              toMs(data?.updatedAt),
              toMs(data?.lastMsgAt),
              toMs(data?.createdAt)
            );
            if (ms > newestPremiumUnreadMs) newestPremiumUnreadMs = ms;
          }
        });

        setUnreadChats(total);
        setPremiumChatKey(newestPremiumUnreadMs > 0 ? newestPremiumUnreadMs : null);
      },
      (e) => console.log("chat badge listener error:", e)
    );

  return () => unsub && unsub();
}, [uid]);

useEffect(() => {
  if (!uid) {
    setHasPremiumNotif(false);
    return;
  }

  const unsub = firestore()
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot(
      (snap) => {
        const hasGold = snap.docs.some((d) => {
          const n = d.data();
          const unread = !(n?.read === true || n?.isRead === true || n?.seen === true);
          return unread && isPremiumNotif(n);
        });
        setHasPremiumNotif(hasGold);
      },
      (e) => console.log("premium notif badge listener error:", e)
    );

  return () => unsub && unsub();
}, [uid]);

 

  // 🟢 Animated gradient setup

return (

<LinearGradient
  colors={['#020617', '#0b1120', '#1f2937']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{ flex: 1 }}
>
  <SafeAreaView style={[styles.container, { backgroundColor: 'transparent', paddingTop: 0, overflow: 'visible' }]}>

<LinearGradient
  colors={['rgba(15,23,42,0.96)', 'rgba(15,23,42,0.92)', 'rgba(15,23,42,0.88)']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={styles.topBar}
>


        {['Match', 'Connections', 'Chats', 'Notifications', 'Profile', 'Settings'].map((screen) => {

          const isActive = active === screen;
          const iconName =
             screen === 'Match' ? 'heart' :
             screen === 'Connections' ? 'account-multiple' :
             screen === 'Chats' ? 'chat' :
             screen === 'Notifications' ? 'bell' :
             screen === 'Profile' ? 'account-circle' :
             'cog';


          return (
           
<TouchableOpacity
  key={screen}
  onPress={() => setActive(screen)}
  style={styles.tabButton}
>
  <View style={[styles.tabPill, isActive && styles.tabPillActive]}>

{(screen === "Chats" && premiumChatKey && premiumChatKey !== seenPremiumChatKey) ? (

    <MaskedView maskElement={<Icon name={iconName} size={32} color="black" />}>
      <LinearGradient
        colors={["#FFFDE7", "#FFF59D", "#FFD54F", "#FFC107", "#FFD700", "#FFFFFF"]}
        locations={[0, 0.2, 0.45, 0.7, 0.9, 1]}
        start={{ x: 0, y: 0.25 }}
        end={{ x: 1, y: 0.85 }}
        style={{ width: 32, height: 32, borderRadius: 999 }}
      />
    </MaskedView>
  ) : isActive ? (
    <MaskedView maskElement={<Icon name={iconName} size={26} color="black" />}>
      <LinearGradient
        colors={["#6366f1", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 26, height: 26, borderRadius: 999 }}
      />
    </MaskedView>
  ) : (
    <Icon name={iconName} size={32} color="#a5b4fc" />
  )}

 

  {/* ✅ ADD THIS RIGHT HERE */}
  {screen === "Chats" && unreadChats > 0 && (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{unreadChats > 99 ? "99+" : unreadChats}</Text>
    </View>
  )}


</View>



  <View style={[styles.activeIndicator, { opacity: isActive ? 1 : 0 }]} />
</TouchableOpacity>


          );
        })}
      </LinearGradient>

      <View style={styles.divider} />

      <View style={{ flex: 1, zIndex: 10, elevation: 10 }}>
                <View style={{ flex: 1 }}>
          <View
            style={[styles.screen, active !== 'Match' && styles.screenHidden]}
            pointerEvents={active === 'Match' ? 'auto' : 'none'}
          >
            <MatchScreen email={userEmail} />
          </View>

          <View
            style={[styles.screen, active !== 'Connections' && styles.screenHidden]}
            pointerEvents={active === 'Connections' ? 'auto' : 'none'}
          >
            <ConnectionsScreen email={userEmail} />
          </View>

          <View
            style={[styles.screen, active !== 'Chats' && styles.screenHidden]}
            pointerEvents={active === 'Chats' ? 'auto' : 'none'}
          >
            <ChatListScreen email={userEmail} />
          </View>

          <View
            style={[styles.screen, active !== 'Notifications' && styles.screenHidden]}
            pointerEvents={active === 'Notifications' ? 'auto' : 'none'}
          >
            <NotificationsScreen />
          </View>

          <View
            style={[styles.screen, active !== 'Profile' && styles.screenHidden]}
            pointerEvents={active === 'Profile' ? 'auto' : 'none'}
          >
            <ProfileScreen email={userEmail} />
          </View>

          <View
            style={[styles.screen, active !== 'Settings' && styles.screenHidden]}
            pointerEvents={active === 'Settings' ? 'auto' : 'none'}
          >
            <SettingsScreen email={userEmail} />
          </View>
        </View>

      </View>
    </SafeAreaView>
  </LinearGradient>
);
}


const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  screen: {
  ...StyleSheet.absoluteFillObject,
},

screenHidden: {
  opacity: 0,
},

badge: {
  position: "absolute",
  top: -2,
  right: -2,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 5,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#ef4444",
  zIndex: 999,
  elevation: 999,
},
badgeText: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "700",
},


logoContainer: {
  alignItems: 'center',
  marginTop: 10,       // move up/down
  marginLeft: -250,    // horizontal position
  zIndex: 20,          // float above buttons
  elevation: 20,
},

profileContainer: {
  width: 50,       // at least same as icon size
  height: 50,
  zIndex: 20,
  elevation: 20,
  alignItems: 'center',
  justifyContent: 'center',
},



logo: {
  width: 160,          // ↔ increase to make wider
  height: 90,          // ↕ increase to make taller
  borderRadius: 8,     // optional: soft corners
},


topBar: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingVertical: -4,
  marginTop: 0,
  marginHorizontal: 0,
  width: '100%',
  borderRadius: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
 shadowColor: '#1f2937', // deep neutral glow
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
  elevation: 8,
},





tabButton: {
  flex: 1, // ✅ equal-width slots so nothing gets pushed off-screen
  alignItems: 'center',
  justifyContent: 'center',
  height: 80,
},

tabPill: {
  position: "relative",      // <-- ADD
  overflow: "visible",       // <-- ADD
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 8,
  paddingVertical: 8,
  borderRadius: 999,
},


tabPillActive: {
  backgroundColor: 'rgba(15,23,42,0.9)',
  borderWidth: 1,
  borderColor: 'rgba(148,163,184,0.7)',
  shadowColor: '#22d3ee',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.45,
  shadowRadius: 22,
  elevation: 10,
},

headerTitle: { 
  fontSize: 26, 
  fontFamily: 'monospace', 
  color: '#333', 
  letterSpacing: -2, 
  marginTop: -4, 
  marginLeft: -10 
},

buttonText: {
  fontSize: 14,
  color: '#e5e7eb',
  fontWeight: '500',
  letterSpacing: 0.3,
},




activeIndicator: {
  marginTop: 10,
  width: 34,
  height: 3,
  borderRadius: 999,
  backgroundColor: '#22d3ee',
  shadowColor: '#38bdf8',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.6,
  shadowRadius: 10,
  elevation: 5,
},


  
activeText: {
  color: '#222222', // 🟢 slightly darker for active state
  fontWeight: 'bold',
  textShadowColor: 'transparent',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 0,
},
  
body: {
  flex: 1,
  zIndex: 1,       // ✅ keeps MatchScreen above logo/topBar
  elevation: 1,    // ✅ Android support
},

/*
divider: {
  height: 1,              // 🟢 thin line
  width: '100%',          // 🟢 full width
  backgroundColor: '#ccc', // 🟢 light gray
  position: 'absolute',
  top: 180,               // 🟢 adjust to align exactly under buttons (tweak if needed)
  zIndex: 9,
    marginTop: -10, // 🔼 move line up (use +5 to move down)

},
*/
  
});
