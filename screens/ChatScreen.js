import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Keyboard,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';


import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from '@react-native-firebase/storage';


const db = firestore();
const threadIdFor = (a, b) => [a, b].sort().join("_");
const toHttpUrl = async (u) => {
  if (!u) return u;
  if (typeof u === "string" && u.startsWith("http")) return u;
  if (typeof u === "string" && u.startsWith("gs://")) return await storage().refFromURL(u).getDownloadURL();
  return await storage().ref(u).getDownloadURL(); // e.g. "giftImages/uid/file.jpg"
};

// ✅ local giftId -> local image (receiver can render instantly)
const LOCAL_GIFTS = {
  rose: require("../assets/gifts/rose.png"),
  teddy: require("../assets/gifts/teddy.png"),
  dog: require("../assets/gifts/dog.png"),
  boyWaving: require("../assets/gifts/boyWaving.png"),
  girlWaving: require("../assets/gifts/girlWaving.png"),
  lovingMan: require("../assets/gifts/lovingMan.png"),
  lovingWoman: require("../assets/gifts/lovingWoman.png"),
  manBlowingFlower: require("../assets/gifts/manBlowingFlower.png"),
  womanBlowingFlower: require("../assets/gifts/womanBlowingFlower.png"),
};




export default function ChatScreen({ route }) {
  const {
    chatId: chatIdParam,
    currentUser,
    otherUser,
    otherUserName,
    otherUserPhoto,
  } = route?.params || {};


  
  const [email, setEmail] = useState('');
const [text, setText] = useState('');
const [messages, setMessages] = useState([]);
const [giftUrlById, setGiftUrlById] = useState({});

// const [isPinned, setIsPinned] = useState(false);
const [isBlocked, setIsBlocked] = useState(false);
const [blockedByMe, setBlockedByMe] = useState(false);
const [blockedByOther, setBlockedByOther] = useState(false);

const looksLikeUid = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{20,}$/.test(s);

const [otherUidResolved, setOtherUidResolved] = useState(otherUser || null);
const [displayOtherName, setDisplayOtherName] = useState(
  otherUserName && !looksLikeUid(otherUserName) ? otherUserName : "User"
);



useEffect(() => {
  const uid = otherUser; // from route params
  if (!uid) return;

  if (otherUserName && !looksLikeUid(otherUserName)) {
    setDisplayOtherName(otherUserName);
    return;
  }

  const unsub = db.collection("users").doc(uid).onSnapshot((s) => {
    const d = s.data();
    const n = d?.name || d?.displayName || d?.username;
    if (n) setDisplayOtherName(n);
  });

  return () => unsub();
}, [otherUser, otherUserName]);


const insets = useSafeAreaInsets();
const [kb, setKb] = useState(0);
const [headerHeight, setHeaderHeight] = useState(0);
const [inputBarH, setInputBarH] = useState(0);


const inputRef = useRef(null);
const resolvedGiftIdsRef = useRef(new Set());
const resolvingGiftIdsRef = useRef(new Set());


const listRef = useRef(null);

const scrollYRef = useRef(0);
const atBottomRef = useRef(true);

const pendingOffsetRef = useRef(0);
const wasAtBottomRef = useRef(true);
const kbActionRef = useRef(null); // 'show' | 'hide' | null
const prevKbRef = useRef(0);

const scrollToBottom = (animated = false) => {
  requestAnimationFrame(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 0);
  });
};


const onListScroll = (e) => {
  const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
  const y = contentOffset.y;

  scrollYRef.current = y;

  const distFromBottom =
    contentSize.height - (y + layoutMeasurement.height);

  atBottomRef.current = distFromBottom < 24; // threshold
};


  const authed = auth().currentUser;
if (!authed) return <SafeAreaView style={styles.screen}><Text>Login required</Text></SafeAreaView>;

const meUid = authed.uid;

  const chatId = chatIdParam || threadIdFor(meUid, otherUser); // keep name "chatId" so rest of file stays same
const statusRef = db.collection("chatStatus").doc(chatId);

const threadRef = db.collection("threads").doc(chatId);
const messagesRef = threadRef.collection("messages");

const inboxToRef   = db.collection("users").doc(otherUser).collection("inbox").doc(chatId);
const inboxFromRef = db.collection("users").doc(meUid).collection("inbox").doc(chatId);

useEffect(() => {
  if (otherUidResolved) return;
  if (!chatId) return;

  (async () => {
    try {
      const t = await threadRef.get();
      const users = t.exists ? t.data()?.users : null;
      const other = Array.isArray(users) ? users.find((u) => u && u !== meUid) : null;
      if (other) setOtherUidResolved(other);
    } catch (e) {}
  })();
}, [chatId, otherUidResolved, meUid]);




  // Load user email
  useEffect(() => {
    const loadEmail = async () => {
      const savedEmail = await AsyncStorage.getItem('email');
      setEmail(savedEmail || currentUser || 'me@example.com');
    };
    loadEmail();
  }, []);

 useEffect(() => {
  const winH = Dimensions.get('window').height;

  const captureAndSetKb = (nextKb) => {
    const prev = prevKbRef.current;

    const opened = prev === 0 && nextKb > 0;
    const closed = prev > 0 && nextKb === 0;

    // Only capture on open/close transitions (prevents jitter on iOS frame changes)
    if (opened || closed) {
      pendingOffsetRef.current = scrollYRef.current;
      wasAtBottomRef.current = atBottomRef.current;
      kbActionRef.current = opened ? 'show' : 'hide';
    }

    prevKbRef.current = nextKb;
    setKb(nextKb);
  };

  const onIOS = (e) => {
    const screenY = e?.endCoordinates?.screenY ?? winH;
    const h = Math.max(0, winH - screenY);
    captureAndSetKb(h);
  };

  const onShow = (e) => captureAndSetKb(e?.endCoordinates?.height ?? 0);
  const onHide = () => captureAndSetKb(0);

  const subs =
    Platform.OS === 'ios'
      ? [Keyboard.addListener('keyboardWillChangeFrame', onIOS)]
      : [
          Keyboard.addListener('keyboardDidShow', onShow),
          Keyboard.addListener('keyboardDidHide', onHide),
        ];

  return () => subs.forEach((s) => s.remove());
}, []);

useEffect(() => {
  if (!kbActionRef.current) return;

  // If user was at bottom, keep latest message fully visible above the input bar.
  if (wasAtBottomRef.current) {
    scrollToBottom(false);
  } else {
    // If user was reading older messages, restore the exact spot after keyboard closes/opens.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: pendingOffsetRef.current,
        animated: false,
      });
    });
  }

  kbActionRef.current = null;
}, [kb, inputBarH]);

useEffect(() => {
  // When input grows (multiline typing), keep the bottom pinned if user is at bottom
  if (atBottomRef.current) scrollToBottom(false);
}, [inputBarH]);

useEffect(() => {
  // When new messages come in, only autoscroll if user was already at bottom
  if (atBottomRef.current) scrollToBottom(false);
}, [messages.length]);


  useEffect(() => {
  if (!email) return;

  const loadStatus = async () => {
    const snap = await statusRef.get();

   if (snap.exists) {
  const data = snap.data();
  const blocked = Array.isArray(data.blockedByUid) ? data.blockedByUid : [];

setIsBlocked(blocked.length > 0);
setBlockedByMe(blocked.includes(meUid));
setBlockedByOther(blocked.some((uid) => uid && uid !== meUid));

} else {
  await statusRef.set(
  {
    users: [meUid, otherUser],
    blockedByUid: [],
  },
  { merge: true }
);
setBlockedByMe(false);
setBlockedByOther(false);

}

  };

  loadStatus();
}, [email, chatId]);

  useEffect(() => {
  if (isBlocked) return;

 const unsub = messagesRef
  .orderBy("createdAt", "asc")
  .onSnapshot((snap) =>
    setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );


  return () => unsub();
}, [chatId, isBlocked]);

useEffect(() => {
  if (isBlocked) return;
  if (!meUid) return;

  const markSeen = async () => {
    const incomingUnseen = [];
for (let i = messages.length - 1; i >= 0 && incomingUnseen.length < 25; i--) {
  const m = messages[i];
  if (m.toUid === meUid && !m.seenAt) incomingUnseen.push(m);
}

    if (!incomingUnseen.length) return;

    const batch = db.batch();
    incomingUnseen.forEach(m => {
      batch.update(messagesRef.doc(m.id), {
        seenAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    // also clear unread in my inbox for this thread
    await inboxFromRef.set({ unreadCount: 0 }, { merge: true });
  };

  markSeen().catch(() => {});
}, [messages, isBlocked, meUid, chatId]);


useEffect(() => {
  const targets = messages.filter((m) => {
    const raw = m.giftImageUrl || m.giftImagePath;
    if (!raw) return false;

    const isHttp = typeof raw === "string" && raw.startsWith("http");
    if (isHttp) return false;

    // prevent infinite retries / UI freeze
    if (resolvedGiftIdsRef.current.has(m.id)) return false;
    if (resolvingGiftIdsRef.current.has(m.id)) return false;

    return true;
  });

  if (!targets.length) return;

  targets.forEach(async (m) => {
    resolvingGiftIdsRef.current.add(m.id);
    try {
      const url = await toHttpUrl(m.giftImageUrl || m.giftImagePath);

      if (typeof url === "string" && url.startsWith("http")) {
       setGiftUrlById((prev) => (prev[m.id] === url ? prev : { ...prev, [m.id]: url }));

      }

      // mark as done (even if url missing) so we don't loop forever
      resolvedGiftIdsRef.current.add(m.id);
    } catch (e) {
      resolvedGiftIdsRef.current.add(m.id);
      // optional:
      // console.warn("Failed to resolve gift image url:", m.id, e);
    } finally {
      resolvingGiftIdsRef.current.delete(m.id);
    }
  });
}, [messages]);




  // Send message
  const handleSend = async () => {
    if (isBlocked) {
      Alert.alert('🚫 Chat blocked', 'You cannot send messages.');
      return;
    }

   if (!text.trim()) return;

   try {

const fromUid = meUid;
const toUid = otherUidResolved;

if (!toUid) {
  Alert.alert("Missing recipient", "Cannot send because receiver uid is missing.");
  return;
}


const msg = text.trim().slice(0, 500);
const ts = firestore.FieldValue.serverTimestamp();

// use the SAME collections as MatchScreen
const threadRef = firestore().collection("threads").doc(chatId);
const messagesRef = threadRef.collection("messages");

const inboxToRef   = firestore().collection("users").doc(toUid).collection("inbox").doc(chatId);
const inboxFromRef = firestore().collection("users").doc(fromUid).collection("inbox").doc(chatId);

// ensure thread exists
await threadRef.set(
  { id: chatId, users: [fromUid, toUid].sort(), createdAt: ts, seenAt: null, updatedAt: ts },
  { merge: true }
);

const msgRef = messagesRef.doc();

await firestore().runTransaction(async (tx) => {
  const threadSnap = await tx.get(threadRef);
  if (!threadSnap.exists) throw new Error("Thread missing");

  tx.set(threadRef, { updatedAt: ts }, { merge: true });

  tx.set(msgRef, {
    threadId: chatId,
    fromUid,
    toUid,
    text: msg,
    createdAt: ts,
  });

  tx.set(
    inboxToRef,
    {
      threadId: chatId,
      otherUid: fromUid,
      otherName: currentUser || "Someone",
      otherPhoto: "",
      lastMessage: msg,
      lastFromUid: fromUid,
      lastAt: ts,
      unreadCount: firestore.FieldValue.increment(1),
    },
    { merge: true }
  );

  tx.set(
    inboxFromRef,
    {
      threadId: chatId,
      otherUid: toUid,
      otherName: otherUserName || "User",
      otherPhoto: otherUserPhoto || "",
      lastMessage: msg,
      lastFromUid: fromUid,
      lastAt: ts,
      unreadCount: 0,
    },
    { merge: true }
  );
});

  setText('');
  scrollToBottom(true);
} catch (e) {
  console.error("Send failed:", e);
  Alert.alert("Send failed", e?.message || "Unknown error");
}


  };


  
const handleMenu = async () => {
  try {
    const snap = await statusRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};

// const pinnedBy = new Set(data.pinnedByUid || []);
    const blockedBy = new Set(data.blockedByUid || []);

    Alert.alert(
      'Chat Options',
     `Status:\n${
         blockedByMe ? '🚫 You blocked this user' :
         blockedByOther ? '🚫 This chat is unavailable' :
        '✅ Active'
        }`,

      [
       

    ...(blockedByMe || !isBlocked
  ? [{
      text: blockedByMe ? 'Unblock User' : 'Block User',
      onPress: async () => {
        try {
          await statusRef.set({ users: [meUid, otherUser].sort() }, { merge: true });

          if (blockedByMe) {
            await statusRef.set(
              { blockedByUid: firestore.FieldValue.arrayRemove(meUid) },
              { merge: true }
            );
          } else {
            await statusRef.set(
              { blockedByUid: firestore.FieldValue.arrayUnion(meUid) },
              { merge: true }
            );
          }

          const after = await statusRef.get();
          const blocked = after.exists && Array.isArray(after.data()?.blockedByUid)
            ? after.data().blockedByUid
            : [];

          setIsBlocked(blocked.length > 0);
          setBlockedByMe(blocked.includes(meUid));
          setBlockedByOther(blocked.some((uid) => uid && uid !== meUid));

          Alert.alert(blocked.length > 0 ? '🚫 User blocked' : '✅ Chat unblocked');
        } catch (e) {
          console.error('block failed:', e);
          Alert.alert('Block failed', e?.message || 'Unknown error');
        }
      },
    }]
  : []),

        { text: 'Cancel', style: 'cancel' },
      ]
    );
  } catch (e) {
    console.error('handleMenu failed:', e);
    Alert.alert('Menu error', e?.message || 'Failed to open chat options.');
  }
};


const lastMyMessageId = React.useMemo(() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if ((m.fromUid ?? m.senderId) === meUid) return m.id;
  }
  return null;
}, [messages, meUid]);
  const renderItem = ({ item }) => {
    const isMe = (item.fromUid ?? item.senderId) === meUid;

    const showStatus = isMe && item.id === lastMyMessageId;

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMe && otherUserPhoto && (
          <Image source={{ uri: otherUserPhoto }} style={styles.avatar} />
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.sender, isMe && { color: '#fff' }]}>
            {isMe ? 'Me' : displayOtherName}

          </Text>
           {(() => {
  const giftKey = item.giftId || item.giftKey; // support either field name
const remoteUrl = giftUrlById[item.id] || item.giftImageUrl || item.giftImagePath;

  const giftSource =
    (giftKey && LOCAL_GIFTS[giftKey]) ? LOCAL_GIFTS[giftKey]
    : (typeof remoteUrl === "string" && remoteUrl.startsWith("http")) ? { uri: remoteUrl }
    : null;

  if (giftKey || remoteUrl) {
  return giftSource ? (
    <Image source={giftSource} style={styles.giftImage} />
  ) : null;
}


  return (
    <Text style={[styles.text, isMe ? styles.myText : styles.otherText]}>
      {item.text}
    </Text>
  );
})()}
{showStatus && (
  <Text style={[styles.seenText, isMe && { color: 'rgba(255,255,255,0.75)' }]}>
    {item.seenAt ? 'Seen' : 'Sent'}
  </Text>
)}

        </View>
      </View>
    );
  };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>


      {/* Header with avatar, name + menu */}
<View
  style={styles.header}
  onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
>
        <View style={styles.headerLeft}>
          {otherUserPhoto ? (
            <Image source={{ uri: otherUserPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarInitial}>
                {(displayOtherName?.[0] || '?').toUpperCase()}

              </Text>
            </View>
          )}

          <View>
            <Text style={styles.headerTitle}>{displayOtherName}</Text>

            <Text style={styles.headerSubtitle}>
              {isBlocked ? 'Chat blocked' : 'Stay in touch'}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleMenu} style={styles.menuButton}>
          <Text style={styles.menu}>⋮</Text>
        </TouchableOpacity>
      </View>

      {isBlocked && (
  <View style={styles.chipRow}>
    <View style={[styles.chip, styles.blockedChip]}>
      <Text style={styles.chipText}>🚫 Blocked</Text>
    </View>
  </View>
)}


      {isBlocked ? (
        <View style={styles.blockedContainer}>
          <Text style={styles.blockedText}>🚫 This chat is unavailable.</Text>
        </View>
      ) : (
        
<View style={styles.container}>


<FlatList
  ref={listRef}
  style={styles.list}
  data={messages}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}

  onScroll={onListScroll}
  scrollEventThrottle={16}

  // IMPORTANT: don't add kb/inputBarH padding here; the list is already above the input in layout
  contentContainerStyle={[styles.chatContainer, { paddingBottom: 12 }]}

  onContentSizeChange={() => {
    if (atBottomRef.current) scrollToBottom(false);
  }}

  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
/>


  <View
  onLayout={(e) => setInputBarH(e.nativeEvent.layout.height)}
  style={[
    styles.inputContainer,
    {
      marginBottom: kb,
      paddingBottom: kb > 0 ? 12 : Math.max(insets.bottom, 12),
    },
  ]}
>


            <TextInput
  ref={inputRef}
  style={styles.input}
  placeholder="Type a message..."
  value={text}
  onChangeText={setText}
  multiline
  editable={!isBlocked}
/>

            <TouchableOpacity
              onPress={handleSend}
              style={styles.sendButton}
              disabled={isBlocked}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>

      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f0ff', // same family as chat list
  },

container: { flex: 1 },

  chatContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },

  // messages
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  myMessageContainer: { alignSelf: 'flex-end' },
  otherMessageContainer: { alignSelf: 'flex-start' },

  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 6 },

  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: '#673ab7',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.08)',
  },

  sender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    color: '#7f7f9c',
  },
  text: { fontSize: 15 },
  myText: { color: '#fff' },
  otherText: { color: '#222' },

  giftImage: {
  width: 200,
  height: 200,
  borderRadius: 12,
  marginTop: 6,
  resizeMode: 'contain',
  alignSelf: 'center',
},

seenText: {
  marginTop: 4,
  fontSize: 11,
  alignSelf: 'flex-end',
},

  // input area
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
  marginBottom: 0,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.15)',
  },
  sendButton: {
    backgroundColor: '#673ab7',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f3f0ff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.4)',
  },
  headerAvatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#673ab7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menu: { fontSize: 22, color: '#444' },

  // chips under header
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  
  blockedChip: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#444',
  },

  // blocked state
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  blockedText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  list: { flex: 1 },
});
