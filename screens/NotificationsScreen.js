import React, { useMemo, useState, useEffect } from 'react';

import { StyleSheet, View, Text, FlatList, Pressable, Animated, Easing } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';


const GOLD = '#D4AF37';
const PURPLE = '#8B5CF6';

const isSuperlikeNotif = (n) => {
  const t = (n?.type || '').toLowerCase();
  return t === 'superlike' || t === 'super_like' || t === 'super-like';
};


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



export default function NotificationsScreen() {
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState([]);
  const [uid, setUid] = useState(auth().currentUser?.uid ?? null);
  const goldSweep = React.useRef(new Animated.Value(0)).current;

useEffect(() => {
  const a = Animated.loop(
    Animated.sequence([
      Animated.timing(goldSweep, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(goldSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])
  );
  a.start();
  return () => a.stop();
}, [goldSweep]);

const goldSweepX = goldSweep.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });


  useEffect(() => {
    const off = auth().onAuthStateChanged((u) => setUid(u?.uid ?? null));
    return off;
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }

    const unsub = firestore()
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setItems(data);
        },
        (err) => {
          console.log('notifications onSnapshot error:', err?.code, err?.message);
        }
      );

    return unsub;
  }, [uid]);



  const filtered = useMemo(() => {
    if (filter === 'Unread') return items.filter((x) => !x.read);
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((x) => !x.read).length, [items]);

 const hasUnreadSuperlike = useMemo(
  () => items.some((n) => !n.read && isSuperlikeNotif(n)),
  [items]
);

const hasUnreadGoldPremium = useMemo(
  () => items.some((n) => !n.read && isPremiumNotif(n) && !isSuperlikeNotif(n)),
  [items]
);


 const markRead = async (id) => {
  const uid = auth().currentUser?.uid;
  if (!uid) return;

  await firestore()
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .doc(id)
    .update({ read: true });
};


const clearAll = async () => {
  const uid = auth().currentUser?.uid;
  if (!uid) return;

  const col = firestore()
    .collection('users')
    .doc(uid)
    .collection('notifications');

  const snap = await col.get();
  if (snap.empty) return;

  const docs = snap.docs;
  const chunkSize = 450;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = firestore().batch();
    docs.slice(i, i + chunkSize).forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }
};




  const Chip = ({ label }) => {
    const active = filter === label;
    return (
      <Pressable onPress={() => setFilter(label)} style={styles.chipWrap}>
        <LinearGradient
         colors={
  active
    ? ['rgba(233,30,99,0.12)', 'rgba(103,58,183,0.10)']
    : ['rgba(255,255,255,0.95)', 'rgba(250,248,255,0.95)']
}


          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.chip, active && styles.chipActive]}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  };

  const formatTime = (createdAt) => {
  const d = createdAt?.toDate?.();
  return d ? d.toLocaleString() : '';
};

  const renderItem = ({ item }) => {
    const glow = !item.read;
    const superlikeUnread = glow && isSuperlikeNotif(item);
const premiumUnread = glow && isPremiumNotif(item) && !superlikeUnread;


    return (
      <Pressable onPress={() => markRead(item.id)} style={{ marginBottom: 12 }}>
        <LinearGradient
   colors={
  glow
    ? ['rgba(233,30,99,0.22)', 'rgba(103,58,183,0.18)']   // brighter unread
    : ['rgba(255,255,255,0.92)', 'rgba(241,245,249,0.92)']
}


          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
style={[
  styles.card,
  glow && { borderColor: 'rgba(233,30,99,0.40)' },
  superlikeUnread && { borderColor: 'rgba(139,92,246,0.70)' },
  premiumUnread && { borderColor: 'rgba(255,215,0,0.60)' },
]}


        >
          <View style={styles.left}>
            <LinearGradient
 colors={
  superlikeUnread
    ? ['rgba(255,255,255,0.55)', 'rgba(139,92,246,0.35)', 'rgba(139,92,246,0.14)']
    : premiumUnread
      ? ['rgba(255,255,255,0.55)', 'rgba(255,215,0,0.38)', 'rgba(255,193,7,0.16)']
      : glow
        ? ['rgba(233,30,99,0.14)', 'rgba(103,58,183,0.10)']
        : ['rgba(255,255,255,0.95)', 'rgba(250,248,255,0.95)']
}

  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
style={[
  styles.iconBubble,
  superlikeUnread && styles.iconBubbleSuperlike,
  premiumUnread && styles.iconBubblePremium,
]}

>
  <Icon
    name={item.icon || 'bell-outline'}
    size={22}
color={superlikeUnread ? PURPLE : (premiumUnread ? GOLD : (glow ? '#e91e63' : '#7a6a9e'))}
  />

  {premiumUnread && (
  <Animated.View
    pointerEvents="none"
    style={[styles.goldShimmer, { transform: [{ translateX: goldSweepX }, { rotate: "-18deg" }] }]}
  >
    <LinearGradient
      colors={["transparent", "rgba(255,255,255,0.95)", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    />
  </Animated.View>
)}

</LinearGradient>

          </View>

          <View style={styles.mid}>
            <View style={styles.row}>
              <Text style={[styles.title, glow && styles.titleGlow]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>

            </View>
            
            
<Text style={[styles.body, premiumUnread && styles.bodyPremium, superlikeUnread && styles.bodySuperlike]} numberOfLines={2}>

  {item.type === "like" && item.fromName
    ? `${item.fromName} liked your profile.`
    : item.body}
</Text>

          </View>

          <View style={styles.right}>
{!item.read ? (
  <View style={[styles.dot, superlikeUnread && styles.dotSuperlike, premiumUnread && styles.dotPremium]} />
) : (
  <View style={styles.dotOff} />
)}

          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
  <SafeAreaView style={styles.screen}>
    <View style={styles.container}>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
  colors={
  hasUnreadSuperlike
    ? ['rgba(139,92,246,0.22)', 'rgba(139,92,246,0.12)']
    : hasUnreadGoldPremium
      ? ['rgba(255,215,0,0.26)', 'rgba(255,193,7,0.14)']
      : ['rgba(233,30,99,0.16)', 'rgba(103,58,183,0.10)']
}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.headerBadge}
>
  <Icon name="bell" size={22} color={hasUnreadSuperlike ? PURPLE : (hasUnreadGoldPremium ? GOLD : '#e91e63')} />

</LinearGradient>


            <View>
              <Text style={styles.hTitle}>Notifications</Text>
              <Text style={styles.hSub}>
                {unreadCount} unread
              </Text>
            </View>
          </View>

          <Pressable onPress={clearAll} hitSlop={10}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.chips}>
          <Chip label="All" />
          <Chip label="Unread" />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <LinearGradient
                colors={['rgba(103,58,183,0.08)', 'rgba(233,30,99,0.06)']}

                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyCard}
              >
                <Icon name="bell-outline" size={34} color="#94a3b8" />
                <Text style={styles.emptyTitle}>All caught up</Text>
                <Text style={styles.emptyBody}>No notifications right now.</Text>
              </LinearGradient>
            </View>
          }
        />
      </View>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({

  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  iconBubblePremium: {
  borderColor: 'rgba(255,215,0,0.85)',
  shadowColor: '#FFD700',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.55,
  shadowRadius: 16,
  elevation: 18,
},

iconBubbleSuperlike: {
  borderColor: 'rgba(139,92,246,0.85)',
  shadowColor: '#8B5CF6',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.45,
  shadowRadius: 16,
  elevation: 18,
},

dotSuperlike: {
  backgroundColor: '#8B5CF6',
  shadowColor: '#8B5CF6',
},

bodySuperlike: { color: PURPLE, fontWeight: '800' },


goldShimmer: {
  position: 'absolute',
  top: -18,
  bottom: -18,
  width: 55,
  left: -55,
  opacity: 0.95,
},

dotPremium: {
  backgroundColor: '#FFD700',
  shadowColor: '#FFD700',
},



  chips: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  chipWrap: { borderRadius: 999, overflow: 'hidden' },

  

  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 },

  screen: { flex: 1, backgroundColor: '#f3f0ff' },


  left: { marginRight: 12 },


  mid: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  

  right: { width: 22, alignItems: 'flex-end' },
 

  emptyWrap: { paddingTop: 24 },
  



titleGlow: { color: '#0f172a' },



emptyCard: {
  borderRadius: 20,
  paddingVertical: 26,
  paddingHorizontal: 18,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(15,23,42,0.08)',
},

container: { flex: 1, backgroundColor: 'transparent' },

hTitle: { color: '#1f1233', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
hSub: { color: '#7a6a9e', fontSize: 12, marginTop: 2 },

clear: { color: '#673ab7', fontSize: 13, fontWeight: '700' },

chip: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.18)',
},
chipActive: { borderColor: 'rgba(233,30,99,0.45)' },
chipText: { color: '#1f1233', fontSize: 12, fontWeight: '700' },
chipTextActive: { color: '#1f1233' },

card: {
  borderRadius: 18,
  padding: 14,
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(233,30,99,0.14)',
},


iconBubble: {
  width: 44,
  height: 44,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: 'rgba(233,30,99,0.22)',
},

headerBadge: {
  width: 42,
  height: 42,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: 'rgba(233,30,99,0.22)',
},

title: { color: '#1f1233', fontSize: 14, fontWeight: '800', flex: 1 },
time: { color: '#7a6a9e', fontSize: 12, fontWeight: '700' },
body: { color: '#333', fontSize: 13, marginTop: 6, lineHeight: 18 },

dot: {
  width: 9,
  height: 9,
  borderRadius: 999,
  backgroundColor: '#e91e63',
  shadowColor: '#e91e63',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 6,
},
dotOff: { width: 9, height: 9, borderRadius: 999, backgroundColor: 'rgba(31,18,51,0.18)' },

emptyTitle: { color: '#1f1233', fontSize: 15, fontWeight: '900', marginTop: 10 },
emptyBody: { color: '#7a6a9e', fontSize: 13, marginTop: 6 },
bodyPremium: { color: GOLD, fontWeight: '800' },



});
