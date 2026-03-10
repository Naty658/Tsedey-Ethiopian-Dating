import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';


import {
  View,
  Text,
  Image,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  InteractionManager,
  FlatList,
  Dimensions,
  Switch,
  TextInput, // ✅ add
  Platform, // ✅ add
  Linking,
} from 'react-native';


import AsyncStorage from '@react-native-async-storage/async-storage';
import RNPickerSelect from 'react-native-picker-select';
//import MultiSlider from '@ptomasroos/react-native-multi-slider'; for react native
//import Slider from '@react-native-community/slider';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import countriesWithCities from '../assets/countriesWithCities.json';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { firebase } from '@react-native-firebase/app';

import { useFocusEffect } from '@react-navigation/native';
import { Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from "@react-native-masked-view/masked-view";
import { Ionicons } from "@expo/vector-icons";
import * as RNIap from 'react-native-iap';
import * as Location from 'expo-location';
import { logFirebaseErr } from '../src/fbDebug';
import { getActiveScreen } from '../src/navigationRef';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

import { NativeModules } from 'react-native';

const PV_IAP_DEBUG = true;
const FREE_MODE = true;

const IAP_LOG_KEY = "iap_diag_buf_v1";
let IAP_MEM = "";


const IAP_NATIVE_PRESENT =
  typeof RNIap?.initConnection === "function" &&
  typeof RNIap?.fetchProducts === "function" &&
  typeof RNIap?.requestPurchase === "function";


function safeJson(x) {
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}

async function iapLog(tag, data) {
  const msg = `[IAP] ${tag}\n${safeJson(data)}`;
  console.log(msg);

    try {
    const line = `${new Date().toISOString()} ${tag}\n${safeJson(data)}\n\n`;
    IAP_MEM = (IAP_MEM + line).slice(-80000); // keep last ~80k
    AsyncStorage.setItem(IAP_LOG_KEY, IAP_MEM).catch(() => {});
  } catch {}

  if (PV_IAP_DEBUG) {
    // Alert.alert('IAP DEBUG', msg.slice(0, 1200));
  }

  try {
    await firestore().collection('iap_debug_logs').add({
      tag,
      data: data ?? null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.log('[IAP] failed to write firestore log', e);
  }
}



const BILLING_RESPONSE = {
  0: "OK",
  1: "USER_CANCELED",
  2: "SERVICE_UNAVAILABLE",
  3: "BILLING_UNAVAILABLE",
  4: "ITEM_UNAVAILABLE",
  5: "DEVELOPER_ERROR",
  6: "ERROR",
  7: "ITEM_ALREADY_OWNED",
  8: "ITEM_NOT_OWNED",
  9: "SERVICE_DISCONNECTED",
  10: "FEATURE_NOT_SUPPORTED",
  11: "ITEM_UNAVAILABLE_ALT",
  12: "NETWORK_ERROR",
};

function iapErr(e) {
  const rc = e?.responseCode;
  return {
    name: e?.name,
    code: e?.code,
    message: e?.message,
    responseCode: rc,
    responseCodeName: rc != null ? (BILLING_RESPONSE[rc] || `UNKNOWN_${rc}`) : null,
    debugMessage: e?.debugMessage,
    productId: e?.productId,
    stack: e?.stack,
    cause: e?.cause ? { message: e.cause?.message, code: e.cause?.code, stack: e.cause?.stack } : null,
    raw: String(e),
  };
}

console.log(Object.keys(NativeModules).filter(k => k.toLowerCase().includes('iap')));

async function iapStep(tag, fn) {
  const t0 = Date.now();
  console.log(`[IAP][${tag}] ▶ START ${new Date(t0).toISOString()}`);

  try {
    const res = await fn();
    const t1 = Date.now();
    console.log(`[IAP][${tag}] ✅ OK in ${t1 - t0}ms`);
    await iapLog(`${tag}_success`, { ms: t1 - t0, res });
    return { ok: true, res };
  } catch (e) {
    const t1 = Date.now();
    const err = iapErr(e);
    console.log(`[IAP][${tag}] ❌ FAIL in ${t1 - t0}ms`);
    console.log(`[IAP][${tag}] responseCode=${err.responseCode} (${err.responseCodeName})`);
    console.log(`[IAP][${tag}] code=${err.code} name=${err.name}`);
    console.log(`[IAP][${tag}] message=${err.message}`);
    console.log(`[IAP][${tag}] debugMessage=${err.debugMessage}`);
    if (err.stack) console.log(`[IAP][${tag}] stack=\n${err.stack}`);
    await iapLog(`${tag}_error`, { ms: t1 - t0, ...err });
    return { ok: false, err: e };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = (p, ms, label = `timeout_${ms}ms`) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
  ]);

async function iapEnvSnapshot() {
  const marketOk =
    Platform.OS === "android"
      ? await Linking.canOpenURL("market://details?id=com.android.vending")
      : null;

  return {
    platform: Platform.OS,
    __DEV__,
    appOwnership: Constants?.appOwnership ?? null,
    executionEnvironment: Constants?.executionEnvironment ?? null,
    appId: Application?.applicationId ?? null,
    nativeVersion: Application?.nativeApplicationVersion ?? null,
    nativeBuild: Application?.nativeBuildVersion ?? null, // Android versionCode as string
    isDevice: Device?.isDevice ?? null,
    brand: Device?.brand ?? null,
    modelName: Device?.modelName ?? null,
    osName: Device?.osName ?? null,
    osVersion: Device?.osVersion ?? null,
    playStoreMarketScheme: marketOk, // false => no Play Store / not Google device
  };
}







const GIFT_IMAGES = {
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


const PREMIUM_BADGE_IMG = require("../assets/premium_badge.png"); // or .jpg/.webp (match filename)



const GradientIcon = ({ name, size, style }) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={<Ionicons name={name} size={size} color="#000" style={style} />}
  >
    <LinearGradient
      colors={["rgba(255,244,204,1)", "rgba(245,158,11,1)", "rgba(180,83,9,1)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

const SuperLikeGradientIcon = ({ name, size, style }) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={<Ionicons name={name} size={size} color="#000" style={style} />}
  >
    <LinearGradient
      colors={["rgba(255,244,204,1)", "rgba(245,158,11,1)", "rgba(180,83,9,1)"]} // EXACT Super Like
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);


const GoldText = ({ children, textStyle }) => (



  <MaskedView
    style={{ alignSelf: "flex-start" }}
    maskElement={<Text style={[textStyle, { color: "#000" }]}>{children}</Text>}
  >
    <LinearGradient
  colors={["#FFFDE7", "#FFF59D", "#FFD54F", "#FFC107", "#FFD700"]}
  locations={[0, 0.25, 0.5, 0.78, 1]}
  start={{ x: 0, y: 0.25 }}
  end={{ x: 1, y: 0.85 }}
>

      <Text style={[textStyle, { opacity: 0 }]}>{children}</Text>
    </LinearGradient>
  </MaskedView>
);








export default function MatchScreen() {
  const navigation = useNavigation();
  const db = firestore(); // ✅ add this
  const [profiles, setProfiles] = useState([]);
const likeDrift = useRef(new Animated.Value(0)).current;
  const msgFloat = useRef(new Animated.Value(0)).current;
const msgSpin  = useRef(new Animated.Value(0)).current;
const msgSweep = useRef(new Animated.Value(0)).current;
const premiumSweep = useRef(new Animated.Value(0)).current;
const premiumShine = useRef(new Animated.Value(0)).current;
const badgeSweep = useRef(new Animated.Value(0)).current;
const badgePulse = useRef(new Animated.Value(0)).current;

const superLikeScale = useRef(new Animated.Value(1)).current;
const superLikePopY  = useRef(new Animated.Value(0)).current;
const screenScale   = useRef(new Animated.Value(1)).current;
const screenSquashX = useRef(new Animated.Value(1)).current;
const screenSquashY = useRef(new Animated.Value(1)).current;
const superLikeMoveX = useRef(new Animated.Value(0)).current;
const superLikeMoveY = useRef(new Animated.Value(0)).current;
const superLikeDeltaRef = useRef({ x: 0, y: 0 });
const superLikeBtnRef = useRef(null);


// 🎁 Gifts
const [giftVisible, setGiftVisible] = useState(false);
const [giftCols, setGiftCols] = useState(2);


const GIFTS = useMemo(() => ([
  { id: "rose",   name: "Rose",   img: require("../assets/gifts/rose.png") },
  { id: "teddy",  name: "Teddy",  img: require("../assets/gifts/teddy.png") },
  { id: "dog",    name: "Puppy",  img: require("../assets/gifts/dog.png") },

  { id: "boyWaving",           name: "Greet",           img: require("../assets/gifts/boyWaving.png") },
  { id: "girlWaving",          name: "Salute",          img: require("../assets/gifts/girlWaving.png") },
  { id: "lovingMan",           name: "Lover",           img: require("../assets/gifts/lovingMan.png") },
  { id: "lovingWoman",         name: "Cute",         img: require("../assets/gifts/lovingWoman.png") },
  { id: "manBlowingFlower",   name: "Romantic",   img: require("../assets/gifts/manBlowingFlower.png") },
  { id: "womanBlowingFlower", name: "Blossom", img: require("../assets/gifts/womanBlowingFlower.png") },
]), []);










const loopsRef = useRef({
  like: null,
  float: null,
  spin: null,
  sweep: null,
  premiumSweep: null,
  premiumShine: null,
  badgeSweep: null,
  badgePulse: null,
});


const restartButtonAnims = useCallback(() => {
  // stop any previous loops (prevents stacking)
  Object.values(loopsRef.current).forEach((a) => a?.stop?.());

  // reset so it never “sticks”
  likeDrift.setValue(0);
  msgFloat.setValue(0);
  msgSpin.setValue(0);
  msgSweep.setValue(0);
  premiumSweep.setValue(0);
  premiumShine.setValue(0);
  badgeSweep.setValue(0);
badgePulse.setValue(0);


  loopsRef.current.like = Animated.loop(
    Animated.sequence([
      Animated.timing(likeDrift, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(likeDrift, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])
  );
  loopsRef.current.like.start();

  loopsRef.current.float = Animated.loop(
    Animated.sequence([
      Animated.timing(msgFloat, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(msgFloat, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])
  );
  loopsRef.current.float.start();

  loopsRef.current.spin = Animated.loop(
    Animated.sequence([
      Animated.timing(msgSpin, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(msgSpin, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])
  );
  loopsRef.current.spin.start();

  loopsRef.current.sweep = Animated.loop(
    Animated.sequence([
      Animated.timing(msgSweep, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(msgSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])
  );
  loopsRef.current.sweep.start();

  loopsRef.current.premiumSweep = Animated.loop(
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(premiumSweep, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(premiumSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])
  );
  loopsRef.current.premiumSweep.start();

  loopsRef.current.premiumShine = Animated.loop(
    Animated.sequence([
      Animated.timing(premiumShine, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(premiumShine, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(1400),
    ])
  );
  loopsRef.current.premiumShine.start();
  loopsRef.current.badgeSweep = Animated.loop(
  Animated.sequence([
    Animated.timing(badgeSweep, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    Animated.timing(badgeSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
  ])
);
loopsRef.current.badgeSweep.start();

loopsRef.current.badgePulse = Animated.loop(
  Animated.sequence([
   Animated.timing(badgePulse, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
Animated.timing(badgePulse, { toValue: 0, duration: 800, easing: Easing.linear, useNativeDriver: true }),

  ])
);
loopsRef.current.badgePulse.start();

}, []);



  const likingRef = useRef(false);
const myKeysRef = useRef({ ids: [] }); // uid + legacyUids + email variants
const [chatReqVisible, setChatReqVisible] = useState(false);
const [chatReqMsg, setChatReqMsg] = useState("");
const [sendingChatReq, setSendingChatReq] = useState(false);
const chatReqInputRef = useRef(null);


const [chatReqSentVisible, setChatReqSentVisible] = useState(false);
const [chatReqSentName, setChatReqSentName] = useState("");
const [reqCount, setReqCount] = useState(0);

// ✅ Direct inbox (Premium)
const [directMsgVisible, setDirectMsgVisible] = useState(false);
const [directMsgText, setDirectMsgText] = useState("");
const [sendingDirectMsg, setSendingDirectMsg] = useState(false);
const directMsgInputRef = useRef(null);




useFocusEffect(
  useCallback(() => {
    // stop any previous loops (prevents stacking)
    Object.values(loopsRef.current).forEach((a) => a?.stop?.());

    // reset so it never “sticks”
    likeDrift.setValue(0);
    msgFloat.setValue(0);
    msgSpin.setValue(0);
    msgSweep.setValue(0);
    premiumSweep.setValue(0);
    premiumShine.setValue(0);
    badgeSweep.setValue(0);
badgePulse.setValue(0);


    loopsRef.current.like = Animated.loop(
      Animated.sequence([
        Animated.timing(likeDrift, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(likeDrift, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loopsRef.current.like.start();

    loopsRef.current.float = Animated.loop(
      Animated.sequence([
        Animated.timing(msgFloat, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(msgFloat, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loopsRef.current.float.start();

    loopsRef.current.spin = Animated.loop(
      Animated.sequence([
        Animated.timing(msgSpin, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(msgSpin, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loopsRef.current.spin.start();

    loopsRef.current.sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(msgSweep, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(msgSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loopsRef.current.sweep.start();

    loopsRef.current.premiumSweep = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(premiumSweep, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(premiumSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loopsRef.current.premiumSweep.start();

    loopsRef.current.premiumShine = Animated.loop(
      Animated.sequence([
        Animated.timing(premiumShine, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(premiumShine, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    loopsRef.current.premiumShine.start();
    loopsRef.current.badgeSweep = Animated.loop(
  Animated.sequence([
    Animated.timing(badgeSweep, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    Animated.timing(badgeSweep, { toValue: 0, duration: 0, useNativeDriver: true }),
  ])
);
loopsRef.current.badgeSweep.start();

loopsRef.current.badgePulse = Animated.loop(
  Animated.sequence([
    Animated.timing(badgePulse, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    Animated.timing(badgePulse, { toValue: 0, duration: 800, easing: Easing.linear, useNativeDriver: true }),

  ])
);
loopsRef.current.badgePulse.start();


    return () => {
      Object.values(loopsRef.current).forEach((a) => a?.stop?.());
    };
  }, [])
);



/*
useEffect(() => {
  askLocationPermission();
}, []);
*/


  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [ageRange, setAgeRange] = useState([18, 100]);
  const [profileLocked, setProfileLocked] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const [lastProfile, setLastProfile] = useState(null);
  // keep latest values for async + useFocusEffect([]) callbacks
const profilesRef = useRef([]);
const indexRef = useRef(0);
const lastProfileRef = useRef(null);
const userChangedGenderFilterRef = useRef(false);


useEffect(() => { profilesRef.current = profiles; }, [profiles]);





const updateSuperLikeDelta = useCallback(() => {
  requestAnimationFrame(() => {
    superLikeBtnRef.current?.measureInWindow?.((x, y, w, h) => {
      const { width, height } = Dimensions.get("window");
      const bx = x + w / 2;
      const by = y + h / 2;
      superLikeDeltaRef.current = { x: width / 2 - bx, y: height / 2 - by };
    });
  });
}, []);

useEffect(() => {
  updateSuperLikeDelta();
  const sub = Dimensions.addEventListener?.("change", updateSuperLikeDelta);
  return () => sub?.remove?.();
}, [updateSuperLikeDelta]);


useEffect(() => { indexRef.current = index; }, [index]);
useEffect(() => { lastProfileRef.current = lastProfile; }, [lastProfile]);

// ✅ listen live presence for currently loaded cards (+ last visible card)
const presenceListenKey = useMemo(() => {
  const ids = Array.from(
    new Set([
      ...profiles.map((p) => p?.uid).filter(Boolean),
      lastProfile?.uid,
    ].filter(Boolean))
  ).slice(0, 120); // keep safe
  return ids.join("|");
}, [profiles, lastProfile]);

useEffect(() => {
  if (!presenceListenKey) return;

  const ids = presenceListenKey.split("|").filter(Boolean);
  if (!ids.length) return;

  const chunks = chunkArray(ids, 10);
  const unsubs = [];

  const patchPresenceIntoUi = (chunkIds, snap) => {
    const map = new Map();
    snap.forEach((d) => map.set(d.id, d.data()));
    const chunkSet = new Set(chunkIds);

    setProfiles((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (!p || !chunkSet.has(p.uid)) return p;
        const updated = applyPresenceToProfile(p, map.get(p.uid) || null);
        if (
  updated.activityLabel !== p.activityLabel ||
  updated.isOnlineStatus !== p.isOnlineStatus ||
  updated._presenceOnlineFlag !== p._presenceOnlineFlag ||
  updated._presenceLastSeen !== p._presenceLastSeen ||
  updated._presenceBucket !== p._presenceBucket
) {
          changed = true;
          return updated;
        }
        return p;
      });
      return changed ? next : prev;
    });

    setLastProfile((prev) => {
      if (!prev || !chunkSet.has(prev.uid)) return prev;
      return applyPresenceToProfile(prev, map.get(prev.uid) || null);
    });
  };

  chunks.forEach((c) => {
    const unsub = db
      .collection("presence")
      .where(firebase.firestore.FieldPath.documentId(), "in", c)
      .onSnapshot(
        (snap) => patchPresenceIntoUi(c, snap),
        (e) => console.log("presence listener error:", e)
      );

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u && u());
}, [presenceListenKey, db]);

useEffect(() => {
  const id = setInterval(() => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (!p) return p;
        const s = getActivityStatus(p._presenceLastSeen, p._presenceOnlineFlag);
        const b = getPresenceBucket(p._presenceLastSeen, p._presenceOnlineFlag);

        if (
          s.label === p.activityLabel &&
          s.isOnline === p.isOnlineStatus &&
          b === p._presenceBucket
        ) return p;

        return { ...p, activityLabel: s.label, isOnlineStatus: s.isOnline, _presenceBucket: b };
      })
    );

    setLastProfile((prev) => {
      if (!prev) return prev;
      const s = getActivityStatus(prev._presenceLastSeen, prev._presenceOnlineFlag);
      const b = getPresenceBucket(prev._presenceLastSeen, prev._presenceOnlineFlag);

      if (
        s.label === prev.activityLabel &&
        s.isOnline === prev.isOnlineStatus &&
        b === prev._presenceBucket
      ) return prev;

      return { ...prev, activityLabel: s.label, isOnlineStatus: s.isOnline, _presenceBucket: b };
    });
  }, 30000);

  return () => clearInterval(id);
}, []);

  const [coords, setCoords] = useState(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState(50);

  // ✅ Premium
const [premiumVisible, setPremiumVisible] = useState(false);
useEffect(() => {
  if (!FREE_MODE) return;
  if (!uid) return;

  const expiresAt = firestore.Timestamp.fromDate(
    new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) // 10 years
  );

  const patch = {
    uid,
    isPremium: true,
    premiumUntil: expiresAt,
    premiumUpdatedAt: firestore.FieldValue.serverTimestamp(),
  };

  db.collection("users").doc(uid).set(patch, { merge: true }).catch(() => {});
  db.collection("profiles").doc(uid).set(patch, { merge: true }).catch(() => {});
  setCurrentUserProfile((p) => ({ ...(p || {}), ...patch }));
}, [uid]);

const [premiumBusy, setPremiumBusy] = useState(false);
const postPremiumActionRef = useRef(null); // "gift" | null



// ✅ Billing (keep FREE for now, but wiring is ready)
const BILLING_LIVE = Platform.OS === "android";
const SUB_SKUS_ANDROID = {
  d3:  "premium_3d",
  w1:  "premium_7d",
  d15: "premium_15d",
  d30: "premium_30d",
};

const ALL_SUB_SKUS = Object.values(SUB_SKUS_ANDROID);
const pendingPlanRef = useRef(null);
const [iapReady, setIapReady] = useState(false);
const [iapStatus, setIapStatus] = useState("booting");

const [iapDiagVisible, setIapDiagVisible] = useState(false);
const [iapDiagText, setIapDiagText] = useState("");

const openIapDiag = async () => {
  const t = (await AsyncStorage.getItem(IAP_LOG_KEY)) || "";
  setIapDiagText(t || "(empty)");
  setIapDiagVisible(true);
};

const clearIapDiag = async () => {
  await AsyncStorage.removeItem(IAP_LOG_KEY);
  IAP_MEM = "";
  setIapDiagText("(cleared)");
};

const offersRef = useRef({}); // sku -> offerToken
const [subsLoaded, setSubsLoaded] = useState(false);


const isPremiumActive = useMemo(() => {
  if (FREE_MODE) return true;

  const untilTs = currentUserProfile?.premiumUntil;
  const until =
    untilTs?.toDate ? untilTs.toDate() :
    untilTs ? new Date(untilTs) :
    null;

  return currentUserProfile?.isPremium === true && (!until || until.getTime() > Date.now());
}, [currentUserProfile]);


const PREMIUM_PLANS = [
  { key: "d3",  label: "3 days",  days: 3,  price: 3  },  // $1.00/day  | Save 50%
  { key: "w1",  label: "1 week",  days: 7,  price: 5  },  // $0.71/day  | Save 64%
  { key: "d15", label: "15 days", days: 15, price: 7  },  // $0.47/day  | Save 77%
  { key: "d30", label: "30 days", days: 30, price: 9  },  // $0.30/day  | Save 85%
];

const PREMIUM_BENEFITS = [
  { key: "unblur", icon: "🔓", title: "Unblur profiles", desc: "See everyone clearly" },
  { key: "dm",     icon: "📩", title: "Free direct inbox", desc: "Message instantly" },
  { key: "super",  icon: "⭐️", title: "Super Like", desc: "Stand out fast" },
  { key: "badge",  icon: "🏅", title: "Premium badge", desc: "Trusted look" },
  { key: "boost",  icon: "🚀", title: "More attention", desc: "More replies & likes" },
  { key: "gift",   icon: "🎁", title: "Free gifts", desc: "Send gifts for $0" },
];



const savingsPct = (days, price) => {
  const full = days * 2;
  return Math.max(0, Math.round((1 - price / full) * 100));
};

const activatePremiumLocally = async (plan) => {
  // wait for auth uid
  let meUid = auth().currentUser?.uid || null;
  for (let i = 0; i < 25 && !meUid; i++) {
    await sleep(200);
    meUid = auth().currentUser?.uid || null;
  }
  if (!meUid) throw new Error("auth_not_ready");

  await AsyncStorage.setItem("uid", meUid).catch(() => {});
  setUid(meUid);

  const expiresAt = firestore.Timestamp.fromDate(
    new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000)
  );

  const patch = {
    uid: meUid,
    isPremium: true,
    premiumUntil: expiresAt,
    premiumDays: plan.days,
    premiumPrice: plan.price,
    premiumUpdatedAt: firestore.FieldValue.serverTimestamp(),
  };

  await iapLog("premium_write_uids", {
    authUid: auth().currentUser?.uid ?? null,
    uidState: uid ?? null,
    uidStorage: (await AsyncStorage.getItem("uid")) ?? null,
    usersDoc: `users/${meUid}`,
    profilesDoc: `profiles/${meUid}`,
  });

  const w1 = await iapStep("write_users_premium", () =>
    db.collection("users").doc(meUid).set(patch, { merge: true })
  );
  if (!w1.ok) throw w1.err;

  const w2 = await iapStep("write_profiles_premium", () =>
    db.collection("profiles").doc(meUid).set(patch, { merge: true })
  );
  if (!w2.ok) throw w2.err;

  setCurrentUserProfile((prev) => ({ ...(prev || {}), ...patch }));
  setPremiumVisible(false);

  if (postPremiumActionRef.current === "gift") {
    postPremiumActionRef.current = null;
    InteractionManager.runAfterInteractions(() => setGiftVisible(true));
  }
  if (postPremiumActionRef.current === "directMessage") {
    postPremiumActionRef.current = null;
    InteractionManager.runAfterInteractions(() => setDirectMsgVisible(true));
  }

  Alert.alert("Premium activated", `You’re premium for ${plan.label}.`);
};

const startPremiumPurchase = async (plan) => {

if (!iapReady) return Alert.alert("Billing", `Billing not ready: ${iapStatus}`);

  await iapLog("native_check", {
  IAP_NATIVE_PRESENT,
  nativeKeys: Object.keys(NativeModules || {}).filter(k => k.toLowerCase().includes("iap")),
  hasRequestSubscription: typeof RNIap.requestSubscription,
  hasBuySubscription: typeof RNIap.buySubscription,
});




  const sku = SUB_SKUS_ANDROID[plan.key];
  if (!sku) return Alert.alert("Billing", "Missing SKU for this plan.");
  // ✅ block buying another plan if any plan already active
const owned = await RNIap.getAvailablePurchases?.();
const active = (owned || []).find(p => ALL_SUB_SKUS.includes(p?.productId));

if (active) {
  if (active.productId === sku) {
    Alert.alert("Already subscribed", "You already have this plan.");
  } else {
    Alert.alert(
      "Already subscribed",
      `You already have an active plan (${active.productId}). Cancel/switch it in Google Play first.`
    );
  }
  return;
}

  setPremiumBusy(true);
  pendingPlanRef.current = plan;

const offerToken = offersRef.current?.[sku] ?? null;



await iapLog("pre_requestSubscription", {
  platform: Platform.OS,
  __DEV__,
  BILLING_LIVE,
  sku,
  offerToken,
});

if (Platform.OS === "android" && !offerToken) {
  await iapLog("missing_offerToken_android", { sku, offersRef: offersRef.current });
}

const buy = await iapStep("requestSubscription", async () => {
  if (Platform.OS === "android" && !offerToken) {
    console.log("[IAP][requestSubscription] ⚠ offerToken missing -> likely DEVELOPER_ERROR or ITEM_UNAVAILABLE");
  }

 return await RNIap.requestPurchase({
  request: {
    android: {
      skus: [sku],
      ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
    },
  },
  type: "subs",
});

});

if (!buy.ok) {
  pendingPlanRef.current = null;
  setPremiumBusy(false);

  const err = iapErr(buy.err);
  Alert.alert(
    "Could not start purchase",
    `responseCode=${err.responseCode} (${err.responseCodeName})\ncode=${err.code}\nmsg=${err.message}\ndebug=${err.debugMessage || ""}`
  );
  return;
}

await iapLog("requestSubscription_success", buy.res);
setPremiumBusy(false);

};

const upgradeToPremium = async (plan) => {
  if (!uid) return Alert.alert("Error", "No user id found.");
  if (premiumBusy) return;

  Alert.alert(
    "Go Premium",
    `${plan.label} for $${plan.price} (${savingsPct(plan.days, plan.price)}% off)`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Activate",
        
onPress: () => {
  if (!BILLING_LIVE) {
    Alert.alert("Premium", "Billing is not enabled in this build.");
    return;
  }
  startPremiumPurchase(plan);
 },
    },
  ]
);
};




  const [matchPopup, setMatchPopup] = useState({
  visible: false,
  me: "",
  them: "",
});


const [filters, setFilters] = useState({
  gender: '',
  country: '',
  currentCountry: '',
  currentCity: '',
  smoke: '',
  drink: '',
  religion: '',
  education: '',
  lookingFor: '',
  activity: '', // ✅ NEW: "" = Any
});

// ✅ searchable picker modal (countries/cities)
const [searchPickVisible, setSearchPickVisible] = useState(false);
const [searchPickTitle, setSearchPickTitle] = useState("");
const [searchPickItems, setSearchPickItems] = useState([]);
const [searchPickQuery, setSearchPickQuery] = useState("");
const searchPickOnSelectRef = useRef((v) => {});

const openSearchPicker = (title, items, onSelect) => {
  setSearchPickTitle(title);
  setSearchPickQuery("");
  searchPickOnSelectRef.current = onSelect;

  // open modal first (fast), then load heavy list
  setSearchPickItems([]);
  setSearchPickVisible(true);

  InteractionManager.runAfterInteractions(() => {
    setSearchPickItems(items || []);
  });
};

const filteredSearchPickItems = useMemo(() => {
  const q = norm(searchPickQuery);
  if (!q) return searchPickItems;
  return searchPickItems.filter((v) => norm(v).includes(q));
}, [searchPickItems, searchPickQuery]);



const askLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Location',
      'Please allow location to see better matches near you.'
    );
    return null;
  }

  const position = await Location.getCurrentPositionAsync({});
  setCoords(position.coords);

  try {
    const [addr] = await Location.reverseGeocodeAsync(position.coords);
    setFilters(prev => ({
  ...prev,
  currentCity: addr?.city || prev.currentCity,
  currentCountry: addr?.country || prev.currentCountry,
}));

  } catch (e) {
    console.log('reverse geocode error', e);
  }

  return position.coords;
};



 useFocusEffect(
  useCallback(() => {
    const loadAndFetch = async () => {
      // FIX: prevent showing wrong previous profile
       // keep current profile on re-focus (no flicker / no dead buttons)
      setNoMatches(false);

  
      const savedUid = await AsyncStorage.getItem('uid');
      if (savedUid) {
        setUid(savedUid);

        // instant render from cache
try {
  const cached = await AsyncStorage.getItem("cached_match_profiles");
  if (cached) {
    const arr = JSON.parse(cached);
   const arrNoPresenceUi = Array.isArray(arr)
  ? arr.map((p) => ({
      ...p,
      _presenceLastSeen: null,
      _presenceOnlineFlag: false,
      activityLabel: null,
      isOnlineStatus: false,
    }))
  : [];
       if (Array.isArray(arrNoPresenceUi) && arrNoPresenceUi.length) {
          setProfiles(arrNoPresenceUi);
      const keepUid =
        profilesRef.current[indexRef.current]?.uid || lastProfileRef.current?.uid || null;

      let nextIndex = 0;
      if (keepUid) {
        const i = arr.findIndex((p) => p.uid === keepUid);
        nextIndex = i >= 0 ? i : Math.min(indexRef.current, arr.length - 1);
      } else {
        nextIndex = Math.min(indexRef.current, arr.length - 1);
      }

      setIndex(nextIndex);
      setLoading(false);
    }

  }
} catch {}

        await fetchProfiles(filters, ageRange, nearbyOnly, coords, { showSpinner: false });

      } else {
        setLoading(false); // nothing logged in
      }
    };
    loadAndFetch();
       return () => {};

  }, [])
);

useEffect(() => {
  let unsub = null;

  (async () => {
    const me = auth().currentUser?.uid || (await AsyncStorage.getItem("uid"));
    if (!me) return;

    unsub = firestore()
      .collection("users")
      .doc(me)
      .collection("chatRequests")
      .where("status", "==", "pending")
      .onSnapshot(
        (snap) => setReqCount(snap.size),
        (e) => console.log("chatRequests listener error:", e)
      );
  })();

  return () => { if (unsub) unsub(); };
}, []);


useEffect(() => {
  let subUpdate;
  let subError;

  (async () => {
    await iapLog("iap_boot", {

      
      platform: Platform.OS,
      __DEV__,
      BILLING_LIVE,
      skus: Object.values(SUB_SKUS_ANDROID),
    });

    // ✅ GLOBAL HARD FAIL LOGS (prints in CMD / Metro)
try {
  const prev = global?.ErrorUtils?.getGlobalHandler?.();
  global?.ErrorUtils?.setGlobalHandler?.((err, isFatal) => {
    console.log(`[IAP][GLOBAL_ERROR] isFatal=${!!isFatal}`);
    console.log(err?.stack || String(err));
    iapLog("global_error", { isFatal: !!isFatal, ...iapErr(err) });
    prev?.(err, isFatal);
  });
} catch {}

try {
  if (global?.process?.on) {
    const onRej = (reason) => {
      console.log("[IAP][UNHANDLED_REJECTION]");
      console.log(reason?.stack || String(reason));
      iapLog("unhandled_rejection", iapErr(reason));
    };
    process.on("unhandledRejection", onRej);
  }
} catch {}

setIapStatus("connecting");

// Don't block on NativeModules name checks (they can be wrong with Nitro/new arch).
await iapLog("iap_native_probe", {
  nativeKeys: Object.keys(NativeModules || {}),
  iapKeys: Object.keys(NativeModules || {}).filter(k => k.toLowerCase().includes("iap")),
  hasInitConnection: typeof RNIap?.initConnection === "function",
});


   await iapStep("env_snapshot", () => iapEnvSnapshot());
try { RNIap.endConnection?.(); } catch {}

   const init = await iapStep("initConnection", () =>
  withTimeout(RNIap.initConnection(), 8000, "initConnection_timeout")
);

if (!init.ok) {
  await sleep(800);
  const init2 = await iapStep("initConnection_retry", () =>
    withTimeout(RNIap.initConnection(), 8000, "initConnection_timeout_retry")
  );

  setIapStatus(init2.ok ? "connected" : "initConnection failed");
  if (!init2.ok) {
    setIapReady(false);
    return;
  }
} else {
  setIapStatus("connected");
}

    setIapStatus(init.ok ? "connected" : "initConnection failed");

    if (!init.ok) {
      setIapReady(false);
      return;
    }

    // Android: flush pending
    if (Platform.OS === "android") {
      await iapStep("flushFailedPurchasesCachedAsPendingAndroid", () =>
        RNIap.flushFailedPurchasesCachedAsPendingAndroid?.()
      );
    }

    // Load products + cache offer tokens
    const skus = Object.values(SUB_SKUS_ANDROID);
const subs = await iapStep("fetchProducts_subs", () =>
  RNIap.fetchProducts({ skus, type: "subs" })
);
    setIapStatus(subs.ok ? "products loaded" : "getSubscriptions failed");
    if (!subs.ok) { setIapReady(false); return; }

    if (subs.ok) {
      if (Platform.OS === "android") {
        const map = {};
        for (const p of subs.res || []) {
const token =
  p?.subscriptionOfferDetailsAndroid?.[0]?.offerToken ??
  p?.subscriptionOffers?.[0]?.offerTokenAndroid ??
  null;
if (token) map[p.id ?? p.productId] = token;        }
        offersRef.current = map;
        await iapLog("offerTokens_cached", map);
      }
      setSubsLoaded(true);
    }

    // Optional restore visibility (helps debug “already owned”, etc.)
const avail = await iapStep("getAvailablePurchases", () => RNIap.getAvailablePurchases?.());
if (avail.ok) {
  const skuList = Object.values(SUB_SKUS_ANDROID);
  const skuToKey = Object.fromEntries(Object.entries(SUB_SKUS_ANDROID).map(([k, sku]) => [sku, k]));

  const best = (avail.res || [])
    .filter(p => skuList.includes(p?.productId))
    .sort((a, b) => (b?.transactionDate || 0) - (a?.transactionDate || 0))[0];

  if (best?.productId) {
    const key = skuToKey[best.productId];
    const plan = PREMIUM_PLANS.find(p => p.key === key);
    if (plan) await activatePremiumLocally(plan);
  }
}
    subUpdate = RNIap.purchaseUpdatedListener(async (purchase) => {
      await iapLog("purchaseUpdated_received", {
        productId: purchase?.productId,
        transactionId: purchase?.transactionId,
        purchaseToken: purchase?.purchaseToken,
        originalJson: purchase?.originalJson,
      });

      const plan = pendingPlanRef.current;
      if (!plan) {
        await iapLog("purchaseUpdated_ignored_noPendingPlan", { productId: purchase?.productId });
        return;
      }

      try {
        if (Platform.OS === "android" && purchase?.purchaseToken) {
          const ack = await iapStep("acknowledgePurchaseAndroid", () =>
            RNIap.acknowledgePurchaseAndroid(purchase.purchaseToken)
          );
          if (!ack.ok) throw ack.err;
        }

        const fin = await iapStep("finishTransaction", () =>
          RNIap.finishTransaction({ purchase, isConsumable: false })
        );
        if (!fin.ok) throw fin.err;

        pendingPlanRef.current = null;
        setPremiumBusy(false);

        await iapLog("grantPremium_start", { plan });
        await iapLog("grantPremium_auth_check", {
  authUid: auth().currentUser?.uid ?? null,
  uidState: uid ?? null,
  uidStorage: (await AsyncStorage.getItem("uid")) ?? null,
});
        await activatePremiumLocally(plan);
        await iapLog("grantPremium_done", { plan });
      } catch (e) {
        await iapLog("purchaseUpdated_handle_error", iapErr(e));
        pendingPlanRef.current = null;
        setPremiumBusy(false);

        Alert.alert(
          "Purchase finish failed",
          `${e?.code || ""} ${e?.message || e?.debugMessage || String(e)}`
        );
      }
    });

    subError = RNIap.purchaseErrorListener(async (e) => {
      await iapLog("purchaseErrorListener", iapErr(e));
      if (e?.code === "already-owned") {
  const mine = auth().currentUser?.uid;
  await iapLog("already_owned_restore", { mine });

  const ps = await RNIap.getAvailablePurchases?.();
  const p = (ps || []).find(x =>
    Object.values(SUB_SKUS_ANDROID).includes(x?.productId)
  );
  if (p) {
    const key = Object.entries(SUB_SKUS_ANDROID).find(([k, sku]) => sku === p.productId)?.[0];
    const plan = PREMIUM_PLANS.find(pp => pp.key === key);
    if (plan) await activatePremiumLocally(plan);
  }
  return;
}
      pendingPlanRef.current = null;
      setPremiumBusy(false);

      Alert.alert(
        "Purchase failed",
        `${e?.code || ""} ${e?.message || e?.debugMessage || "Try again."}`
      );
    });

    setIapStatus("ready");

    setIapReady(true);
    await iapLog("iap_ready", { ok: true });
  })();

  return () => {
    try { subUpdate?.remove?.(); } catch {}
    try { subError?.remove?.(); } catch {}
    try { RNIap.endConnection(); } catch {}
  };
}, []);

useEffect(() => {
  console.log('IAP native modules:', Object.keys(NativeModules).filter(k => k.toLowerCase().includes('iap')));
}, []);


const toRad = (deg) => (deg * Math.PI) / 180;

const distanceKm = (c1, c2) => {
  if (!c1 || !c2) return Infinity;
  const R = 6371;
  const dLat = toRad(c2.latitude - c1.latitude);
  const dLon = toRad(c2.longitude - c1.longitude);
  const lat1 = toRad(c1.latitude);
  const lat2 = toRad(c2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
const toJsDateSafe = (v) => {
  if (!v) return null;

  try {
    // Firestore Timestamp
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }

    // JS Date
    if (v instanceof Date) {
      return Number.isNaN(v.getTime()) ? null : v;
    }

    // Firestore-like { seconds, nanoseconds }
    if (typeof v === "object" && typeof v.seconds === "number") {
      const ms = (v.seconds * 1000) + Math.floor((v.nanoseconds || 0) / 1e6);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // number (seconds or ms)
    if (typeof v === "number") {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // numeric string / ISO string
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return null;

      if (/^\d+$/.test(s)) {
        const n = Number(s);
        const ms = n < 1e12 ? n * 1000 : n;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch {}

  return null;
};

const getActivityStatus = (lastSeenInput, onlineFlag) => {
  const d = toJsDateSafe(lastSeenInput);

  // ✅ if backend says online but timestamp missing, still show online
  if (!d) {
    return onlineFlag ? { label: "Active now", isOnline: true } : { label: null, isOnline: false };
  }

  const now = Date.now();
  const t = d.getTime();

  // ignore crazy future times (bad clock)
  if (t > now + 5 * 60 * 1000) return { label: null, isOnline: false };

  const diffMs = Math.max(0, now - t);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  // ✅ only show green online dot if online flag + fresh heartbeat
  if (onlineFlag && diffMin <= 3) return { label: "Active now", isOnline: true };

  // ✅ more accurate labels
  if (diffMin <= 1) return { label: "Active just now", isOnline: false };
  if (diffMin < 60) return { label: `Active ${diffMin} min ago`, isOnline: false };
  if (diffHr < 24) return { label: `Active ${diffHr}h ago`, isOnline: false };
  if (diffDay === 1) return { label: "Active yesterday", isOnline: false };
  if (diffDay <= 7) return { label: `Active ${diffDay}d ago`, isOnline: false };
  if (diffDay <= 30) return { label: "Active lately", isOnline: false };

  return { label: null, isOnline: false };
};

const getPresenceBucket = (lastSeenInput, onlineFlag) => {
  const d = toJsDateSafe(lastSeenInput);

  if (!d) return onlineFlag ? "online_now" : "unknown";

  const now = Date.now();
  const t = d.getTime();
  if (t > now + 5 * 60 * 1000) return "unknown";

  const diffMs = Math.max(0, now - t);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (onlineFlag && diffMin <= 3) return "online_now";   // "Active now"
  if (diffMin <= 1) return "just_now";                   // "Active just now"
  if (diffMin < 60) return "mins";                       // "Active X min ago"
  if (diffHr < 24) return "hours";                       // "Active Xh ago"
  if (diffDay === 1) return "yesterday";                 // "Active yesterday"
  if (diffDay <= 7) return "days7";                      // "Active Xd ago"
  return "older";
};

const parsePresence = (presence) => {
  if (!presence) {
    return {
      rawLastSeen: null,
      onlineFlag: false,
      bucket: "unknown",
      status: { label: null, isOnline: false },
    };
  }

  const rawLastSeen =
    presence?.lastSeen ??
    presence?.lastSeenAt ??
    presence?.lastActiveAt ??
    presence?.heartbeatAt ??
    presence?.updatedAt ??
    presence?.stateChangedAt ??
    presence?.last_changed ??
    null;

  const stateStr = String(presence?.status ?? presence?.state ?? "").trim().toLowerCase();

  const onlineFlag =
    presence?.online === true ||
    presence?.isOnline === true ||
    String(presence?.online).toLowerCase() === "true" ||
    String(presence?.isOnline).toLowerCase() === "true" ||
    ["online", "active", "available"].includes(stateStr);

  const status = getActivityStatus(rawLastSeen, onlineFlag);
  const bucket = getPresenceBucket(rawLastSeen, onlineFlag);

  return { rawLastSeen, onlineFlag, bucket, status };
};

const applyPresenceToProfile = (p, presence) => {
  const parsed = parsePresence(presence);
  return {
    ...p,
    _presenceLastSeen: parsed.rawLastSeen ?? null,
    _presenceOnlineFlag: !!parsed.onlineFlag,
    _presenceBucket: parsed.bucket,          // ✅ NEW
    activityLabel: parsed.status.label,
    isOnlineStatus: parsed.status.isOnline,
  };
};

// ✅ normalize comparisons (fixes case + spaces + smart quotes)
function norm(v) {
  return String(v ?? "")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase();
}


const eq = (a, b) => norm(a) === norm(b);
const contains = (a, b) => norm(a).includes(norm(b));

const interestedInToGender = (v) => {
  const s = norm(v);
  if (s === "men") return "Male";
  if (s === "women") return "Female";
  return "";
};


const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchProfiles = async (
  customFilters = filters,
  customAge = ageRange,
  customNearbyOnly = nearbyOnly,
  customCoords = coords,
  opts = { showSpinner: true }
) => {
  try {
    if (opts.showSpinner) setLoading(true);

    const savedUid = await AsyncStorage.getItem("uid");
    if (!savedUid) { setLoading(false); return; }
    setUid(savedUid);

    // 1) Fetch ONLY me (no full collection scan)
    let me = null;
    const meSnap = await db.collection("profiles").doc(savedUid).get();
    if (meSnap.exists) {
      me = { id: meSnap.id, uid: savedUid, ...meSnap.data() };
    } else {
      // fallback if your docId isn't uid
      const q = await db.collection("profiles").where("uid", "==", savedUid).limit(1).get();
      if (!q.empty) {
        const d = q.docs[0];
        me = { id: d.id, uid: d.data().uid ?? d.id, ...d.data() };
      }
    }
    setCurrentUserProfile(me);

    const myEmailRaw = me?.email || (await AsyncStorage.getItem("email")) || "";
    const myEmailNorm = norm(myEmailRaw);
    myKeysRef.current.ids = Array.from(new Set([savedUid, myEmailRaw, myEmailNorm].filter(Boolean)));

    const locked = !(me && me.isComplete === true);
    setProfileLocked(locked);

    if (!locked) {
  const preferredGender = interestedInToGender(me?.interestedIn);

  if (!userChangedGenderFilterRef.current && preferredGender && !eq(customFilters.gender, preferredGender)) {
  customFilters = { ...customFilters, gender: preferredGender };
  setFilters((prev) =>
    userChangedGenderFilterRef.current ? prev : { ...prev, gender: preferredGender }
  );
}

}


    // 2) Pull a LIMITED candidate set from Firestore (fast)
    // NOTE: this requires profiles.hidden to exist (default false).
    let candSnap;
    try {
      let q = db.collection("profiles").where("isComplete", "==", true);
candSnap = await q.limit(250).get();

    } catch (e) {
      // fallback if you don't have hidden/isComplete indexed everywhere
      candSnap = await db.collection("profiles").limit(250).get();
    }

    let others = candSnap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, uid: data.uid ?? d.id, ...data };
      })
.filter((p) => p.uid !== savedUid && p.hidden !== true);

    // 3) Apply your existing client-side filters to the limited set
    if (!locked) {
      const currentCoords = customCoords || coords;

      others = others.filter((p) => {
        const age = Number(p.age) || 0;
        if (age < customAge[0] || age > customAge[1]) return false;
        if (customFilters.gender && !eq(p.gender, customFilters.gender)) return false;

        if (customFilters.country) {
          const f = customFilters.country;
          const fromMatch =
            eq(p.from, f) ||
            eq(p.nationality, f) ||
            eq(p.originCountry, f) ||
            eq(p.hometownCountry, f);
          if (!fromMatch) return false;
        }

        if (customFilters.smoke && !eq(p.smoke, customFilters.smoke)) return false;
        if (customFilters.drink && !eq(p.drink, customFilters.drink)) return false;
        if (customFilters.religion && !eq(p.religion, customFilters.religion)) return false;
        if (customFilters.education && !eq(p.education, customFilters.education)) return false;
        if (customFilters.lookingFor && !eq(p.lookingFor, customFilters.lookingFor)) return false;

        if (customFilters.currentCountry) {
          const f = customFilters.currentCountry;
          const cc = p.country ?? p.currentCountry ?? p.liveCountry ?? p.locationCountry ?? "";
          if (!eq(cc, f)) return false;
        }

        if (customFilters.currentCity) {
          const city = p.city ?? p.currentCity ?? p.location ?? p.liveCity ?? "";
          if (!contains(city, customFilters.currentCity)) return false;
        }

        if (customNearbyOnly && currentCoords) {
          const plat = p.lat ?? p.latitude ?? p.coords?.latitude;
          const plng = p.lng ?? p.longitude ?? p.coords?.longitude;
          if (plat == null || plng == null) return false;
          const dist = distanceKm(currentCoords, { latitude: plat, longitude: plng });
          if (dist > maxDistanceKm) return false;
        }

        return true;
      });

      // 4) passes/likes -> Sets (fast)
      const [passesSnap, likesSnap] = await Promise.all([
        db.collection("users").doc(savedUid).collection("passes").get(),
        db.collection("users").doc(savedUid).collection("likes").get(),
      ]);
      const passedSet = new Set(passesSnap.docs.map((d) => d.id));
      const likedSet = new Set(likesSnap.docs.map((d) => d.id));

      others = others.filter((p) => !passedSet.has(p.uid) && !likedSet.has(p.uid));
    }

    // 5) Presence: batch via documentId() "in" queries (10 at a time)
    const uids = others.map((p) => p.uid).filter(Boolean);
    const presenceMap = new Map();
    const uidChunks = chunkArray(uids, 10);

    await Promise.all(
      uidChunks.map(async (c) => {
        if (!c.length) return;
        const ps = await db
          .collection("presence")
          .where(firebase.firestore.FieldPath.documentId(), "in", c)

          .get();
        ps.forEach((doc) => presenceMap.set(doc.id, doc.data()));
      })
    );

   const withPresence = others.map((p) => applyPresenceToProfile(p, presenceMap.get(p.uid)));
   let finalList = withPresence;

const act = customFilters?.activity || "";
if (act) {
  finalList = finalList.filter((p) => p?._presenceBucket === act);
}

    const keepUid =
  profilesRef.current[indexRef.current]?.uid || lastProfileRef.current?.uid || null;

setProfiles(finalList);

let nextIndex = 0;

if (finalList.length) {
  if (keepUid) {
    const i = finalList.findIndex((p) => p.uid === keepUid);
    nextIndex = i >= 0 ? i : Math.min(indexRef.current, finalList.length - 1);
  } else {
    nextIndex = Math.min(indexRef.current, finalList.length - 1);
  }
} else {
  // prevent showing stale lastProfile when filtered list becomes empty
  setLastProfile(null);
  lastProfileRef.current = null;
  nextIndex = 0;
}

setIndex(nextIndex);
setNoMatches(locked ? false : finalList.length === 0);


    // 6) Cache for instant next open
    try {
      await AsyncStorage.setItem("cached_match_profiles", JSON.stringify(finalList.slice(0, 60)));
    } catch {}

    setLoading(false);
  } catch (e) {
    console.log("🔥 Firestore error:", e);
    setLoading(false);
  }
};

// ✅ auto-unlock when profile becomes complete (no manual Refresh)
useEffect(() => {
  if (!uid) return;

  const unsub = db
    .collection("profiles")
    .doc(uid)
    .onSnapshot(
      (snap) => {
        const complete = snap.exists && snap.data()?.isComplete === true;
        setProfileLocked(!complete);

        // if just unlocked, pull matches immediately
        if (complete) fetchProfiles(undefined, undefined, undefined, undefined, { showSpinner: false });
      },
      (e) => console.log("profile completion listener error:", e)
    );

  return () => unsub && unsub();
}, [uid]);


const writeNotification = async (toUid, notifId, data) => {
  const fromUid = auth().currentUser?.uid;
  if (!toUid || !fromUid) return;

  const col = db.collection("users").doc(toUid).collection("notifications");

  const payload = {
    ...data,
    toUid,        // REQUIRED by rules
    fromUid,      // REQUIRED by rules (must equal auth uid)
      fromIsPremium: isPremiumActive === true,
  fromPremiumUntil: currentUserProfile?.premiumUntil ?? null,

    read: false,  // REQUIRED by rules (or omit read)
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  // sender cannot update/delete in your rules, so always CREATE
  await col.add(payload);
};


const isLikedTrue = (snap) => {
  if (!snap?.exists) return false;
  const v = snap.data()?.liked;
  return v === true || v === 1 || v === "true";
};



// ✅ put this near isLikedTrue (top-level, not inside checkAndCreateMatch)
const didUserLikeMe = async (otherUid, myIds) => {
  const col = db.collection("users").doc(otherUid).collection("likes");
  for (const id of myIds) {
    const snap = await col.doc(id).get();
    if (isLikedTrue(snap)) return true;
  }
  return false;
};

const checkAndCreateMatch = async (currentUser, targetUser) => {
 
  // ...keep the rest of your existing match creation logic unchanged


 const users = [currentUser.uid, targetUser.uid].sort();
const matchId = `${users[0]}_${users[1]}`;

try {


await db.collection("matches").doc(matchId).set(
  {
    users, // ✅ sorted to satisfy rules
    userDetails: {
      [currentUser.uid]: {
        name: currentUser.name || "Unknown",
        photo: currentUser.photo || "",
        age: currentUser.age || "",
      },
      [targetUser.uid]: {
        name: targetUser.name || "Unknown",
        photo: targetUser.photo || "",
        age: targetUser.age || "",
      },
    },
    timestamp: firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

} catch (e) {
  console.log("MATCH CREATE FAILED:", e);
  return false;
}

   try {
 await Promise.all([
  writeNotification(currentUser.uid, null, {
    type: "match",
    title: "It’s a match",
    body: "You both liked each other.",
    icon: "heart",
    otherUid: targetUser.uid,
    otherName: targetUser.name || "Unknown",
    otherPhoto: targetUser.photo || "",
    refId: matchId,
  }),
  writeNotification(targetUser.uid, null, {
    type: "match",
    title: "It’s a match",
    body: "You both liked each other.",
    icon: "heart",
    otherUid: currentUser.uid,
    otherName: currentUser.name || "Unknown",
    otherPhoto: currentUser.photo || "",
    refId: matchId,
  }),
]);

} catch (e) {
  console.log("match notification failed:", e);
}


  return true;
};




const playSuperLikeFx = useCallback(() => {
  const { x: dx, y: dy } = superLikeDeltaRef.current || { x: 0, y: 0 };

  superLikeScale.stopAnimation();
  superLikePopY.stopAnimation();
  superLikeMoveX.stopAnimation();
  superLikeMoveY.stopAnimation();

  superLikeScale.setValue(1);
  superLikePopY.setValue(0);
  superLikeMoveX.setValue(0);
  superLikeMoveY.setValue(0);

  Animated.sequence([
    Animated.parallel([
      Animated.timing(superLikeMoveX, {
        toValue: dx,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(superLikeMoveY, {
        toValue: dy,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(superLikeScale, {
        toValue: 10,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(superLikeScale, {
        toValue: 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }),
    ]),
    Animated.parallel([
      Animated.timing(superLikeMoveX, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(superLikeMoveY, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]),
  ]).start();
}, []);





const handleSuperLike = () => {
  if (profileLocked) {
    Alert.alert("Profile not finished", "Finish your profile to unlock matches 💕");
    return;
  }

  if (!isPremiumActive) {
    setPremiumVisible(true);
    return;
  }

  playSuperLikeFx();
  handleLike({ superLike: true }); // ✅ DIFFERENT
};


const handleGift = () => {
  if (profileLocked) {
    Alert.alert("Profile not finished", "Finish your profile to unlock matches 💕");
    return;
  }

  // first time (not premium) -> show Premium screen only
  if (!isPremiumActive) {
    postPremiumActionRef.current = "gift";
    setPremiumVisible(true);
    return;
  }

  // premium -> show gifts
  setGiftVisible(true);
};


const sendGift = async (gift) => {
  const targetUser =
    profilesRef.current[indexRef.current] ||
    lastProfileRef.current ||
    profiles[index] ||
    lastProfile;

  if (!targetUser) return;

  // premium gate
  if (!isPremiumActive) {
    setGiftVisible(false);
    setPremiumVisible(true);
    return;
  }

  const fromUid = auth().currentUser?.uid;
  if (!fromUid || !targetUser?.uid || !currentUserProfile) return;

  const toUid = targetUser.uid;
  const tId = threadIdFor(fromUid, toUid);

  const fromName =
    currentUserProfile?.name ||
    currentUserProfile?.username ||
    "Someone";
  const fromPhoto = currentUserProfile?.photo || "";

  const toName = targetUser?.name || "User";
  const toPhoto = targetUser?.photo || "";

  try {
    const threadRef = db.collection("threads").doc(tId);
    const msgRef = threadRef.collection("messages").doc();

    const inboxToRef = db.collection("users").doc(toUid).collection("inbox").doc(tId);
    const inboxFromRef = db.collection("users").doc(fromUid).collection("inbox").doc(tId);

    const users = [fromUid, toUid].sort();
    const lastText = `🎁 ${gift.name}`;

    // keep same premium patch style as direct inbox (safe for rules)
    const patch = { isPremium: true };
    if (currentUserProfile?.premiumUntil) patch.premiumUntil = currentUserProfile.premiumUntil;
    await db.collection("users").doc(fromUid).set(patch, { merge: true });

    // create/merge thread
    await threadRef.set(
      {
        id: tId,
        users,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.runTransaction(async (tx) => {
      const threadSnap = await tx.get(threadRef);
      if (!threadSnap.exists) throw new Error("Thread missing");

      tx.set(threadRef, { updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
tx.set(msgRef, {
  threadId: tId,
  fromUid,
  toUid,
  type: "gift",
  text: lastText,
  giftId: gift.id,
  giftName: gift.name,
  giftSymbol: "🎁",
  giftKey: gift.id, // alias in case other screens use giftKey
  createdAt: firestore.FieldValue.serverTimestamp(),
});



      // receiver inbox
      tx.set(
        inboxToRef,
        {
          threadId: tId,
          otherUid: fromUid,
          otherName: fromName,
          otherPhoto: fromPhoto,
          lastMessage: lastText,
          lastFromUid: fromUid,
          lastAt: firestore.FieldValue.serverTimestamp(),
          unreadCount: firestore.FieldValue.increment(1),
        },
        { merge: true }
      );

      // sender inbox
      tx.set(
        inboxFromRef,
        {
          threadId: tId,
          otherUid: toUid,
          otherName: toName,
          otherPhoto: toPhoto,
          lastMessage: lastText,
          lastFromUid: fromUid,
          lastAt: firestore.FieldValue.serverTimestamp(),
          unreadCount: 0,
        },
        { merge: true }
      );
    });

    // optional notification
    await writeNotification(toUid, null, {
      type: "gift",
      title: "New gift",
      body: `${fromName} sent you a ${gift.name} 🎁`,
      icon: "gift",
      fromUid,
      fromName,
      fromPhoto,
      refId: tId,
      giftId: gift.id,
      giftName: gift.name,
    });

    setGiftVisible(false);
    Alert.alert("Sent", `${gift.name} sent 🎁`);
  } catch (e) {
    console.log("sendGift failed:", e);
    Alert.alert("Error", "Could not send gift.");
  }
};



  const handleLike = async ({ superLike = false } = {}) => {

  if (profileLocked) {
    Alert.alert("Profile not finished", "Finish your profile to unlock matches 💕");
    return;
  }


  if (likingRef.current) return;
  likingRef.current = true;

  try {
const targetUser =
  profilesRef.current[indexRef.current] ||
  lastProfileRef.current ||
  profiles[index] ||
  lastProfile;
    if (!targetUser || !uid || !currentUserProfile) return;

    const likeRef = db
  .collection("users")
  .doc(uid)
  .collection("likes")
  .doc(targetUser.uid);

const targetEmailId = norm(targetUser?.email);
const likeRefEmail = targetEmailId
  ? db.collection("users").doc(uid).collection("likes").doc(targetEmailId)
  : null;


    const statRef = db
      .collection("users")
      .doc(uid)
      .collection("likeStats")
      .doc(targetUser.uid);

      const likedByRef = db
  .collection("users")
  .doc(targetUser.uid)
  .collection("likedBy")
  .doc(uid);


    let newCount = 1;
    let shouldNotify = false;
    let bucketIndex = 0;

    // keep your same transaction logic, but don't let failures freeze the UI
    try {
      const res = await db.runTransaction(async (tx) => {
  // ✅ READS FIRST (required)
  const [statSnap, likeSnap] = await Promise.all([
    tx.get(statRef),
    tx.get(likeRef),
  ]);

  const prevCount = statSnap.exists ? Number(statSnap.data()?.count || 0) : 0;
  const nextCount = prevCount + 1;

  // ✅ WRITES AFTER ALL READS
  tx.set(
    statRef,
    { count: nextCount, updatedAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  if (!likeSnap.exists) {
    tx.set(likeRef, {
  liked: true,
  superLike: superLike === true, // ✅ add
  updatedAt: firestore.FieldValue.serverTimestamp(),
}, { merge: true });


if (likeRefEmail) {
 tx.set(
  likeRefEmail,
  {
    liked: true,
    superLike: superLike === true, // ✅ add
    updatedAt: firestore.FieldValue.serverTimestamp(),
    emailKey: true,
  },
  { merge: true }
);

}

// next code...

  } else {
    tx.set(
      likeRef,
      { liked: true, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

tx.set(
  likedByRef,
  {
    liked: true,
    superLike: superLike === true, // ✅ add
    fromUid: uid,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);


  const notify = superLike ? true : (nextCount === 1 || nextCount % 5 === 0);

  const bucket = nextCount === 1 ? 0 : Math.floor(nextCount / 5);

  return { newCount: nextCount, shouldNotify: notify, bucketIndex: bucket };
});


      newCount = res.newCount;
      shouldNotify = res.shouldNotify;
      bucketIndex = res.bucketIndex;
    } catch (e) {
      console.log("runTransaction(like) failed:", e);

      // fallback: still record the like so swipe UI continues
      await likeRef.set(
        { liked: true, updatedAt: firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      shouldNotify = false; // safest: no extra notif if tx failed
    }

    const fromUid = auth().currentUser?.uid;


    if (shouldNotify) {
      try {
        const likerName =
          currentUserProfile?.name ||
          currentUserProfile?.username ||
          currentUserProfile?.displayName ||
          "Someone";

        const likerPhoto =
          currentUserProfile?.photo ||
          currentUserProfile?.photoURL ||
          currentUserProfile?.avatar ||
          "";

      await writeNotification(targetUser.uid, null, {
  type: superLike ? "super_like" : "like",
  title: superLike ? "Super Like" : "New like",
  body: superLike ? `${likerName} super liked you ⭐️` : `${likerName} liked your profile.`,
  icon: superLike ? "star" : "heart",
  fromUid: fromUid,
  fromName: likerName,
  fromPhoto: likerPhoto,
  refId: fromUid,
  likeCount: newCount,
  bucketIndex,
  superLike: superLike === true,
});


      } catch (e) {
        console.log("writeNotification(like) failed:", e);
      }
    }

const likedBack = await didUserLikeMe(targetUser.uid, myKeysRef.current.ids);

if (likedBack) {
  const didMatch = await checkAndCreateMatch(currentUserProfile, targetUser);
  if (didMatch) {
    setMatchPopup({ visible: true, me: currentUserProfile.photo, them: targetUser.photo });
    return;
  }
}



    nextUser();
  } catch (e) {
    console.log("handleLike failed:", e);
    nextUser(); // don’t freeze on any unexpected error
  } finally {
    likingRef.current = false;
  }
};



const handleDirectMessage = () => {
  if (profileLocked) {
    Alert.alert("Finish profile", "Complete your profile to message.");
    return;
  }

  const targetUser =
    profilesRef.current[indexRef.current] ||
    lastProfileRef.current ||
    profiles[index] ||
    lastProfile;

  if (!targetUser) return;

  // not premium -> go premium
  if (!isPremiumActive) {
    postPremiumActionRef.current = "directMessage";
    setPremiumVisible(true);
    return;
  }

  // premium -> open direct inbox composer
  setDirectMsgVisible(true);
};





const openChatRequest = () => {
  if (profileLocked) {
    Alert.alert("Profile not finished", "Finish your profile to send chat requests 💬");
    return;
  }
if (!(profilesRef.current[indexRef.current] || lastProfileRef.current || profiles[index] || lastProfile)) return;

  setChatReqVisible(true);
};

const threadIdFor = (a, b) => [a, b].sort().join("_");

const sendDirectInboxMessage = async () => {
  if (sendingDirectMsg) return;
  if (!isPremiumActive) { setDirectMsgVisible(false); setPremiumVisible(true); return; }

  const targetUser =
    profilesRef.current[indexRef.current] ||
    lastProfileRef.current ||
    profiles[index] ||
    lastProfile;

  const fromUid = auth().currentUser?.uid;
  if (!fromUid || !targetUser?.uid || !currentUserProfile) return;

  const text = (directMsgText || "").trim().slice(0, 500);
  if (!text) return Alert.alert("Message", "Type a message.");

  setSendingDirectMsg(true);

  try {
    const toUid = targetUser.uid;
    const tId = threadIdFor(fromUid, toUid);
    const fromName =
  currentUserProfile?.name ||
  currentUserProfile?.username ||
  "Someone";
const fromPhoto = currentUserProfile?.photo || "";

const toName = targetUser?.name || "User";
const toPhoto = targetUser?.photo || "";


const threadRef = db.collection("threads").doc(tId);
const msgRef = threadRef.collection("messages").doc();

const inboxToRef = db.collection("users").doc(toUid).collection("inbox").doc(tId);
const inboxFromRef = db.collection("users").doc(fromUid).collection("inbox").doc(tId);

const users = [fromUid, toUid].sort();

// rules check isPremiumUser() using /users/{uid}, not /profiles
if (isPremiumActive) {
  const patch = { isPremium: true };
  if (currentUserProfile?.premiumUntil) patch.premiumUntil = currentUserProfile.premiumUntil;
  await db.collection("users").doc(fromUid).set(patch, { merge: true });
}


// ✅ create-or-merge thread (NO get(); get is denied when doc doesn't exist)
await threadRef.set(
  {
    id: tId,
    users,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    createdAt: firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

await db.runTransaction(async (tx) => {
  // ✅ READS FIRST (only thread)
  const threadSnap = await tx.get(threadRef);
  if (!threadSnap.exists) throw new Error("Thread missing");

  tx.set(
    threadRef,
    { updatedAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  tx.set(msgRef, {
    threadId: tId,
    fromUid,
    toUid,
    text,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  // ✅ receiver inbox: increment without reading
  tx.set(
    inboxToRef,
    {
      threadId: tId,
      otherUid: fromUid,
      otherName: fromName,
      otherPhoto: fromPhoto,
      lastMessage: text,
      lastFromUid: fromUid,
      lastAt: firestore.FieldValue.serverTimestamp(),
      unreadCount: firestore.FieldValue.increment(1),
    },
    { merge: true }
  );

  // ✅ sender inbox
  tx.set(
    inboxFromRef,
    {
      threadId: tId,
      otherUid: toUid,
      otherName: toName,
      otherPhoto: toPhoto,
      lastMessage: text,
      lastFromUid: fromUid,
      lastAt: firestore.FieldValue.serverTimestamp(),
      unreadCount: 0,
    },
    { merge: true }
  );
});



    // optional notification
    await writeNotification(toUid, null, {
      type: "direct_message",
      title: "New message",
      body: `${fromName}: ${text}`,
      icon: "mail",
      fromUid,
      fromName,
      fromPhoto,
      refId: tId,
    });

    setDirectMsgVisible(false);
    setDirectMsgText("");
    Alert.alert("Sent", "Message delivered to inbox ✅");
  } catch (e) {
    console.log("sendDirectInboxMessage failed:", e);
    Alert.alert("Error", "Could not send message.");
  } finally {
    setSendingDirectMsg(false);
  }
};


const sendChatRequest = async () => {
  if (sendingChatReq) return;
  setSendingChatReq(true);

  try {
const targetUser =
  profilesRef.current[indexRef.current] ||
  lastProfileRef.current ||
  profiles[index] ||
  lastProfile;
const fromUid = auth().currentUser?.uid;
if (!fromUid) {
  Alert.alert("Login required", "Please sign in again.");
  return;
}
if (!targetUser || !fromUid || !currentUserProfile) return;


    const fromName = currentUserProfile?.name || "Someone";
    const fromPhoto = currentUserProfile?.photo || "";
    const msg = (chatReqMsg || "").trim().slice(0, 60);

   // ✅ if already matched, just skip request (or navigate to chat if you want)


// IMPORTANT: don't doc-get /matches/{matchId}.
// Your rules deny get() when the doc doesn't exist.
let alreadyMatched = false;

try {
  const myMatchesSnap = await db
    .collection("matches")
    .where("users", "array-contains", fromUid)
    .get();

  alreadyMatched = myMatchesSnap.docs.some((d) => {
    const users = d.data()?.users || [];
    return users.includes(fromUid) && users.includes(targetUser.uid);
  });
} catch (e) {
  // If something goes wrong here, don't block sending a request.
  console.log("match check failed (ignored):", e);
}


if (alreadyMatched) {
  setChatReqVisible(false);
  setChatReqMsg("");
  Alert.alert("Already matched", "Open your chat from Connections.");
  return;
}



    const inboxReqRef = db
      .collection("users")
      .doc(targetUser.uid)
      .collection("chatRequests")
.doc(fromUid); // one request per sender


    const outReqRef = db
      .collection("users")
.doc(fromUid)
.collection("sentChatRequests")
.doc(targetUser.uid);


    await db.runTransaction(async (tx) => {
  const inboxSnap = await tx.get(inboxReqRef);

  // don't spam duplicates
  const st = inboxSnap.exists ? inboxSnap.data()?.status : null;
  if (st === "pending" || st === "accepted") return;

  const payload = {
  fromUid,
  fromName,
  fromPhoto,
  toUid: targetUser.uid,
  message: msg,
  status: "pending",
  createdAt: firestore.FieldValue.serverTimestamp(),
};

  // ✅ receiver inbox
  tx.set(inboxReqRef, payload, { merge: true });

  // ✅ sender outbox
  tx.set(outReqRef, payload, { merge: true });
});

    // ✅ notify receiver
    await writeNotification(targetUser.uid, null, {
      type: "chat_request",
      title: "Chat request",
      body: msg ? `${fromName}: ${msg}` : `${fromName} wants to chat.`,
      icon: "chat",
      fromUid: uid,
      fromName,
      fromPhoto,
      refId: uid,
    });

    setChatReqVisible(false);
setChatReqMsg("");
setChatReqSentName(targetUser?.name || "them");
setChatReqSentVisible(true);
  } catch (e) {
    console.log("sendChatRequest failed:", e);
    Alert.alert("Error", "Could not send chat request.");
  } finally {
    setSendingChatReq(false);
  }
};





const handlePass = async () => {
  if (profileLocked) return;

const targetUser =
  profilesRef.current[indexRef.current] ||
  lastProfileRef.current ||
  profiles[index] ||
  lastProfile;
  if (!targetUser || !uid) return;

  await db.collection('users').doc(uid).collection('passes').doc(targetUser.uid).set({
    passed: true,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  nextUser();
};




// --- Gift button (mirrors Super Like but on the PASS side) ---
const GIFT_SIZE = 54;
const GIFT_DX = 74;      // negative = pull left (safe near right edge)
const GIFT_DY = -473;      // gift up and down  - up   + down
const GIFT_ICON_SIZE = 18;

const giftAbsStyle = {
  transform: [
    { translateX: -(GIFT_SIZE / 2) + GIFT_DX },
    { translateY: GIFT_DY },
  ],
};

const giftCircleStyle = {
  width: GIFT_SIZE,
  height: GIFT_SIZE,
  borderRadius: 16, // ✅ curved rectangular (adjust 12-20)
};


const giftIconStyle = { fontSize: GIFT_ICON_SIZE };



const nextUser = () => {
  if (profileLocked) return;

  setIndex((prev) => {
    const next = prev + 1;

    if (next < profiles.length) return next;

    if (profiles[prev]) setLastProfile(profiles[prev]);
    setProfiles([]);
    setNoMatches(true);
    return prev;
  });
};




 const applyFilters = async () => {
  let activeCoords = coords;

  if (nearbyOnly && !activeCoords) {
    activeCoords = await askLocationPermission();
    if (!activeCoords) {
      // user denied -> don't apply nearby-only
      setNearbyOnly(false);
      return;
    }
  }

  setFilterVisible(false);
  setLoading(true);
  await fetchProfiles(filters, ageRange, nearbyOnly, activeCoords);
  setLoading(false);
};




const clearFilters = async () => {


  userChangedGenderFilterRef.current = true; // lock it so fetchProfiles doesn't overwrite reset

 const resetFilters = {
  gender: interestedInToGender(currentUserProfile?.interestedIn),
  country: '',
  currentCountry: '',
  currentCity: '',
  smoke: '',
  drink: '',
  religion: '',
  education: '',
  lookingFor: '',
  activity: "",
};

  const resetAge = [18, 100];

  setFilters(resetFilters);
  setAgeRange(resetAge);
  setNearbyOnly(false);
  setMaxDistanceKm(50);

  setFilterVisible(false);
  setNoMatches(false);   // hide overlay

  // 👇 force nearby filter OFF for this fetch
  await fetchProfiles(resetFilters, resetAge, false); 
};


const deleteDocsBatched = async (docs) => {
  const CHUNK = 450; // < 500 Firestore batch limit
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
};


const resetSwipes = async () => {
  try {
    const savedUid = await AsyncStorage.getItem("uid");
    if (!savedUid) return;

    // Hard reset UI + refs so fetchProfiles doesn't "keep" an old card
    setLoading(true);
    setNoMatches(false);
    setProfiles([]);
    setLastProfile(null);
    setIndex(0);

    profilesRef.current = [];
    lastProfileRef.current = null;
    indexRef.current = 0;

    // Prevent instant re-hydrate of stale cards
    try { await AsyncStorage.removeItem("cached_match_profiles"); } catch {}

    const [passesSnap, likesSnap] = await Promise.all([
      db.collection("users").doc(savedUid).collection("passes").get(),
      db.collection("users").doc(savedUid).collection("likes").get(),
    ]);

    await deleteDocsBatched(passesSnap.docs);
    await deleteDocsBatched(likesSnap.docs);

    await fetchProfiles(filters, ageRange, nearbyOnly, coords, { showSpinner: false });
  } catch (e) {
    console.log("resetSwipes error:", e);
  } finally {
    setLoading(false);
  }
};









    const options = (arr) => arr.map((v) => ({ label: v, value: v }));

  const allCountries = countriesWithCities
    .map((c) => c.country)
    .sort();

  const getCitiesForCountry = (countryName) => {
    if (!countryName) return [];
    const item = countriesWithCities.find((c) => c.country === countryName);
    return item ? item.cities : [];
  };

  const religions = ["Christian","Muslim","Jewish","Hindu","Buddhist","Spiritual","Atheist","Other"];
  const lookingForList = ["Friendship","Casual Dating","Serious Relationship","Marriage","Other"];
  // 👆 no hardcoded cities array anymore



  const user = profiles[index];
const displayUser = profiles[index] ?? lastProfile ?? null;

// remember last seen profile while swiping
useEffect(() => {
  if (user) {
    setLastProfile(user);
  }
}, [user]);


  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={PALETTE.accent} />
        <Text>Loading profiles...</Text>
      </View>
    );
  }


const likeY = likeDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
const likeR = likeDrift.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-1.6deg"] });

const msgY = msgFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
const spin = msgSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
const sweepX = msgSweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] });
const premiumShineOpacity = premiumShine.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.92] });
const premiumRingOpacity  = premiumShine.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.52] });
const premiumSweepX       = premiumSweep.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
const badgeSweepX = badgeSweep.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

const badgeFastSweepX = badgeSweep.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
const badgeGlowOpacity = badgePulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });
const badgeScale = badgePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
const BADGE_FX_DY = 18; // +down (try 10-30)




return (
  <LinearGradient
    colors={[PALETTE.bgFrom, PALETTE.bgMid, PALETTE.bgTo]}
    locations={[0, 0.4, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.screenBg}
  >
<View style={{ flex: 1 }}>

      <View style={{ flex: 1, position: "relative" }} pointerEvents={profileLocked || noMatches ? "none" : "auto"}>







{/* FILTER */}
<TouchableOpacity
  onPress={() => setFilterVisible(true)}
style={[styles.topAction, styles.filtersBtn, styles.posFilters]}

  activeOpacity={0.85}
>
  <Text style={styles.topActionIcon}>☰</Text>
  <Text style={styles.topActionLabel}>Filters</Text>


</TouchableOpacity>

{/* Premium pill hidden for now */}
{!FREE_MODE && (
    <TouchableOpacity
    onPress={() => setPremiumVisible(true)}
    onLongPress={openIapDiag}
    delayLongPress={700}
    style={[styles.topAction, styles.premiumPillAction, styles.posPremium]}
    activeOpacity={0.9}
  >
    <LinearGradient
      colors={["#FDE68A", "#F59E0B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.premiumPillGradient}
    >

    <View style={styles.premiumPillTextWrap}>
  <Text
    style={styles.premiumPillTitle}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.85}
  >
    GO PREMIUM
  </Text>

  <View style={styles.premiumPillFreeChip}>
    <Text style={styles.premiumPillFreeChipText} numberOfLines={1}>
      FREE
    </Text>
  </View>
</View>


 
    </LinearGradient>
  </TouchableOpacity>
)}







{/* 3 DOTS / MENU */}
<TouchableOpacity
  onPress={() => {
    Alert.alert(
      "Report",
      "Report this profile?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",

          onPress: async () => {
            if (!user || !uid) return;
           await db.collection("reports").add({
  reporterUid: uid,
  reportedUid: user.uid,
  reason: "Inappropriate profile", // optional: change later to picker/input
  status: "open",                  // open | reviewing | resolved
  source: "match_screen",
  reportedName: user?.name || "",
  reportedPhoto: user?.photo || "",
  createdAt: firestore.FieldValue.serverTimestamp(),
});


            Alert.alert("Reported", "Thanks, we received your report.");
          }
        }
      ]
    );
  }}
style={[styles.topAction, styles.menuBtn, styles.posMenu]}


  activeOpacity={0.85}
>
  <View style={styles.menuInner}>
    <Text style={styles.topActionIcon}>⋯</Text>
    <View style={styles.menuBadge} />
  </View>
</TouchableOpacity>

{/* MESSAGE REQUEST (SCI-FI, under menu) */}
<Animated.View style={[styles.msgAction, { transform: [{ translateY: msgY }] }]}>
  <TouchableOpacity onPress={openChatRequest} activeOpacity={0.9} style={styles.msgHit}>
    <LinearGradient
colors={["rgba(34,211,238,0.60)", "rgba(99,102,241,0.60)", "rgba(15,23,42,0.995)"]}

      
      
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.msgPill}
    >
      <Animated.View pointerEvents="none" style={[styles.msgHalo, { transform: [{ rotate: spin }] }]} />

      <View style={styles.msgRow}>
        <Text style={styles.msgIcon}>💬</Text>
        <Text style={styles.msgLabel}>CHAT REQUEST</Text>

      </View>

      <Animated.View pointerEvents="none" style={[styles.msgScan, { transform: [{ translateX: sweepX }] }]}>
        <LinearGradient
          colors={["transparent", "rgba(34,211,238,0.45)", "transparent"]}

          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>

{/* Send direct message (icon only) */}
<TouchableOpacity
  onPress={handleDirectMessage}
  activeOpacity={0.85}
  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
  style={[
    styles.posInbox,
    {
      position: "absolute",
      zIndex: 10000,
      backgroundColor: "transparent",
      padding: 0,
      transform: [{ translateX: INBOX_DX }, { translateY: INBOX_DY }],
    },
  ]}
>

    <View
    style={{
      width: INBOX_ICON_SIZE + 4,
      height: INBOX_ICON_SIZE + 4,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Ionicons
      name="chatbubble-ellipses"
      size={INBOX_ICON_SIZE + 4}
      color="#FFD700"
      style={{ position: "absolute" }}
    />
    <SuperLikeGradientIcon name="chatbubble-ellipses" size={INBOX_ICON_SIZE} />
  </View>




</TouchableOpacity>



  <ScrollView
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingBottom: 80 }}
  bounces={false}
  alwaysBounceVertical={false}
  overScrollMode="never"
>




    <View style={styles.container}>

      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        </View>
        
      </View>


    {displayUser ? (
  <>
    {displayUser.photo ? (
      <View style={styles.photoBox}>
  <Image source={{ uri: displayUser.photo }} style={styles.photo} />






  {profileLocked && (
    <BlurView
      intensity={90}
      tint="light"
      style={StyleSheet.absoluteFillObject}
    />
  )}
     <LinearGradient
  colors={["transparent", PALETTE.overlayMid, PALETTE.overlayBottom]}
  start={{ x: 0, y: 0 }}
  end={{ x: 0, y: 1 }}
  style={styles.posterOverlay}
>
  <View style={styles.posterTitleRow}>
    <View style={{ flex: 1 }}>
     {displayUser?.isPremium ? (
  <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
    <GoldText textStyle={styles.posterNamePremium}>
      {displayUser.name || "Unknown"}
    </GoldText>
    {displayUser.age ? <Text style={styles.posterAge}> · {displayUser.age}</Text> : null}
  </View>
) : (
  <Text style={styles.posterName}>
    {displayUser.name || "Unknown"}
    {displayUser.age ? <Text style={styles.posterAge}> · {displayUser.age}</Text> : null}
  </Text>
)}


          {displayUser.activityLabel && (
    <View style={styles.activityRow}>
      {displayUser.isOnlineStatus && <View style={styles.activityDot} />}
      <Text style={styles.activityText}>{displayUser.activityLabel}</Text>
    </View>
  )}

      {(displayUser.city || displayUser.from) && (
        <Text style={styles.posterLocation}>
          📍 {displayUser.city}
          {displayUser.city && displayUser.from ? " · " : ""}
          {displayUser.from}
        </Text>
      )}
    </View>

   <View style={styles.posterTagWrap}>
  <View style={styles.posterTag}>
    <Text style={styles.posterTagText}>Featured</Text>
  </View>

{false && (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.featuredPremiumBadgeWrap,
{
  width: PREMIUM_BADGE_W,
  height: PREMIUM_BADGE_H,
  transform: [{ translateX: PREMIUM_BADGE_DX }, { translateY: PREMIUM_BADGE_DY }, { scale: badgeScale }],
},

    ]}
  >
   <Image source={PREMIUM_BADGE_IMG} style={styles.featuredPremiumBadgeImgFill} />

<MaskedView
  style={StyleSheet.absoluteFill}
  maskElement={
    <Image source={PREMIUM_BADGE_IMG} style={styles.featuredPremiumBadgeImgFill} />
  }
>
  {/* subtle glow (now clipped to badge shape) */}
  <Animated.View
    pointerEvents="none"
    style={[
      StyleSheet.absoluteFillObject,
      { opacity: Animated.multiply(badgeGlowOpacity, 0.55), transform: [{ translateY: BADGE_FX_DY }] },

    ]}
  >
    <LinearGradient
      colors={["rgba(253,230,138,0.00)", "rgba(253,230,138,0.18)", "rgba(253,230,138,0.00)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    />
  </Animated.View>

  {/* fast shimmer sweep (now clipped to badge shape) */}
  <Animated.View
    pointerEvents="none"
    style={[
      styles.badgeShimmer,
      { transform: [{ translateY: BADGE_FX_DY }, { translateX: badgeFastSweepX }, { rotate: "-18deg" }] },
    ]}
  >
    <LinearGradient
      colors={["transparent", "rgba(255,255,255,0.9)", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    />
  </Animated.View>
</MaskedView>

  </Animated.View>
)}

</View>

  </View>

  {displayUser.bio ? (
    <Text style={styles.posterBio} numberOfLines={2}>
      {displayUser.bio}
    </Text>

  ) : (

    
    <Text style={styles.posterBio} numberOfLines={2}>
      A little mysterious… tap ❤︎ to see where the story goes.
    </Text>
  )}
</LinearGradient>


      </View>
    ) : (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No photo yet</Text>
      </View>
    )}

    <LinearGradient
  colors={[PALETTE.cardFrom, PALETTE.cardTo]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.profileCard}
>
  <Text style={styles.detailsTitle}>Details</Text>

  {/* row 1 */}
  <View style={styles.metaRow}>
    {displayUser.gender && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Gender</Text>
        <Text style={styles.metaValue}>{displayUser.gender}</Text>
      </View>
    )}

    {displayUser.lookingFor && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Looking for</Text>
        <Text style={styles.metaValue}>{displayUser.lookingFor}</Text>
      </View>
    )}
  </View>

  {/* row 2 */}
  <View style={styles.metaRow}>
    {displayUser.religion && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Religion</Text>
        <Text style={styles.metaValue}>{displayUser.religion}</Text>
      </View>
    )}

    {displayUser.diet && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Diet</Text>
        <Text style={styles.metaValue}>{displayUser.diet}</Text>
      </View>
    )}
  </View>

  {/* row 3 */}
  <View style={styles.metaRow}>
    {displayUser.smoke && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Smoke</Text>
        <Text style={styles.metaValue}>{displayUser.smoke}</Text>
      </View>
    )}

    {displayUser.drink && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Drink</Text>
        <Text style={styles.metaValue}>{displayUser.drink}</Text>
      </View>
    )}
  </View>

  {/* row 4 */}
  <View style={styles.metaRow}>
    {displayUser.education && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Education</Text>
        <Text style={styles.metaValue}>{displayUser.education}</Text>
      </View>
    )}

    {displayUser.occupation && (
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Occupation</Text>
        <Text style={styles.metaValue}>{displayUser.occupation}</Text>
      </View>
    )}
  </View>

  {/* single column fields */}
  {displayUser.hobby && (
    <View style={[styles.metaItem, { marginTop: 12 }]}>
      <Text style={styles.metaLabel}>Hobby</Text>
      <Text style={styles.metaValue}>{displayUser.hobby}</Text>
    </View>
  )}

  {displayUser.languages && (
    <View style={[styles.metaItem, { marginTop: 12 }]}>
      <Text style={styles.metaLabel}>Languages</Text>
      <Text style={styles.metaValue}>{displayUser.languages}</Text>
    </View>
  )}

  {(displayUser.from || displayUser.country || displayUser.city) && (
    <View style={[styles.metaItem, { marginTop: 12 }]}>
      <Text style={styles.metaLabel}>Location</Text>
      <Text style={styles.metaValue}>
        {displayUser.from ? `From ${displayUser.from}` : ''}
        {displayUser.from && (displayUser.city || displayUser.country) ? ' · ' : ''}
        {displayUser.city || displayUser.country
          ? `Lives in ${
              displayUser.city
                ? displayUser.city + (displayUser.country ? ', ' : '')
                : ''
            }${displayUser.country || ''}`
          : ''}
      </Text>
    </View>
  )}

  {displayUser.bio && (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.metaLabel}>About</Text>
      <Text style={styles.metaValue}>{displayUser.bio}</Text>
    </View>
  )}

  <Text style={styles.profileHint}>Scroll down for more photos</Text>
</LinearGradient>


    <LinearGradient
  colors={[PALETTE.extraFrom, PALETTE.extraTo]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.extraSection}
>

      {displayUser.extraPhotos && displayUser.extraPhotos.length > 0 && (
        <>
          <View style={styles.extraHeaderRow}>
            <Text style={styles.extraTitle}>More scenes</Text>
            <View style={styles.extraDivider} />
          </View>

          {displayUser.extraPhotos.map((uri, index) => (
            <View key={index} style={styles.extraBigPhotoBox}>
              <Image source={{ uri }} style={styles.extraBigPhoto} />
            </View>
          ))}
        </>
      )}
    </LinearGradient>
  </>
) : (
  <>
    {!displayUser && !profileLocked && (
  <Text style={styles.end}>No matches found — adjust your filters 💕</Text>
)}
 </>
)}




      {/* Filter Modal */}
      <Modal visible={filterVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalTitle}>Filter Matches</Text>
              <Text style={styles.label}>Age Range: {ageRange[0]} - {ageRange[1]}</Text>
              <MultiSlider
                values={ageRange}
                sliderLength={250}
                onValuesChange={setAgeRange}
                min={18}
                max={100}
                step={1}
                selectedStyle={{ backgroundColor: PALETTE.accent }}
                markerStyle={{ backgroundColor: PALETTE.accent }}
              />
              
<View style={styles.nearbyRow}>
  <Text style={styles.label}>Nearby only</Text>
  <Switch
    value={nearbyOnly}
    onValueChange={setNearbyOnly}
    thumbColor={nearbyOnly ? PALETTE.accent : '#e5e7eb'}
    trackColor={{ false: '#d1d5db', true: '#4f46e5' }}
  />
</View>

<View
  style={{ opacity: nearbyOnly ? 1 : 0.35 }}
  pointerEvents={nearbyOnly ? 'auto' : 'none'}
>
  <Text style={styles.label}>
    Nearby distance: {Math.round(maxDistanceKm)} km
  </Text>
  <MultiSlider
    values={[maxDistanceKm]}
    sliderLength={250}
    onValuesChange={(vals) => setMaxDistanceKm(vals[0])}
    min={5}
    max={500}
    step={5}
    selectedStyle={{ backgroundColor: PALETTE.accent }}
    markerStyle={{ backgroundColor: PALETTE.accent }}
  />
</View>


<Text style={[styles.label, styles.activeFilterLabel]}>Who is active?</Text>

<View style={styles.activeFilterPickWrap}>

<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, activity: v })}
  value={filters.activity}
  items={[
    { label: "Any", value: "" },
    { label: "Active now", value: "online_now" },
    { label: "Active just now", value: "just_now" },
    { label: "Active (1-59 min ago)", value: "mins" },
    { label: "Active (1-23h ago)", value: "hours" },
    { label: "Active yesterday", value: "yesterday" },
    { label: "Active (2-7d ago)", value: "days7" },
  ]}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}
/>
</View>

             <Text style={styles.label}>Gender</Text>
<RNPickerSelect
onValueChange={(v) => {
  userChangedGenderFilterRef.current = true;
  setFilters({ ...filters, gender: v });
}}
  value={filters.gender}
  items={options(['Male', 'Female'])}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>


<Text style={styles.label}>Country from</Text>
<Pressable
  onPress={() =>
    openSearchPicker("Country from", allCountries, (v) =>
      setFilters((p) => ({ ...p, country: v }))
    )
  }
  style={styles.fauxPick}
>
  <Text
    style={[
      styles.fauxPickText,
      !filters.country && styles.fauxPickPlaceholder,
    ]}
  >
    {filters.country || "Select an item"}
  </Text>
</Pressable>



<Text style={styles.label}>Current country</Text>
<Pressable
  onPress={() =>
    openSearchPicker("Current country", allCountries, (v) =>
      setFilters((p) => ({ ...p, currentCountry: v, currentCity: "" }))
    )
  }
  style={styles.fauxPick}
>
  <Text
    style={[
      styles.fauxPickText,
      !filters.currentCountry && styles.fauxPickPlaceholder,
    ]}
  >
    {filters.currentCountry || "Select an item"}
  </Text>
</Pressable>


<Text style={styles.label}>Current city</Text>
<Pressable
  onPress={() => {
    if (!filters.currentCountry) return Alert.alert("Select country first");
    openSearchPicker(
      "Current city",
      getCitiesForCountry(filters.currentCountry),
      (v) => setFilters((p) => ({ ...p, currentCity: v }))
    );
  }}
  style={styles.fauxPick}
>
  <Text
    style={[
      styles.fauxPickText,
      !filters.currentCity && styles.fauxPickPlaceholder,
    ]}
  >
    {filters.currentCity || "Select an item"}
  </Text>
</Pressable>



<Text style={styles.label}>Do you smoke?</Text>
<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, smoke: v })}
  value={filters.smoke}
  items={options(['No','Rarely','Occasionally','Socially','Often','Daily'])}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>


<Text style={styles.label}>Do you drink?</Text>
<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, drink: v })}
  value={filters.drink}
  items={options(['No','Rarely','Occasionally','Socially','Often','Daily'])}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>


<Text style={styles.label}>Religion</Text>
<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, religion: v })}
  value={filters.religion}
  items={options(religions)}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>


<Text style={styles.label}>Education</Text>
<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, education: v })}
  value={filters.education}
  items={options(['High School', 'Bachelor’s', 'Master’s', 'PhD', 'Other'])}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>


<Text style={styles.label}>Looking For</Text>
<RNPickerSelect
  onValueChange={(v) => setFilters({ ...filters, lookingFor: v })}
  value={filters.lookingFor}
  items={options(lookingForList)}
  style={pickerSelectStyles}
  useNativeAndroidPickerStyle={false}

/>






<View style={{ marginVertical: 20 }}>
  <Button title="Apply Filters" onPress={applyFilters} color={PALETTE.accent}/>
  <View style={{ height: 10 }} />
  <Button title=" Clear filters" onPress={clearFilters} color="gray" />
  <View style={{ height: 10 }} />
  <Button title="Close" onPress={() => setFilterVisible(false)} />
</View>

            </ScrollView>
          </View>
        </View>
      </Modal>


{/* Search Picker Modal */}
<Modal visible={searchPickVisible} animationType="fade" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalBox}>
      <Text style={styles.modalTitle}>{searchPickTitle}</Text>

      <TextInput
        value={searchPickQuery}
        onChangeText={setSearchPickQuery}
        placeholder="Type to search…"
        placeholderTextColor="#64748b"
        style={styles.searchInput}
      />

      <FlatList
  style={{ marginTop: 10 }}
  data={filteredSearchPickItems}
  keyExtractor={(v) => String(v)}
  keyboardShouldPersistTaps="handled"
  initialNumToRender={24}
  windowSize={8}
  removeClippedSubviews
  renderItem={({ item: v }) => (
    <Pressable
      onPress={() => {
        searchPickOnSelectRef.current?.(v);
        setSearchPickVisible(false);
      }}
      style={styles.searchItem}
    >
      <Text style={styles.searchItemText}>{v}</Text>
    </Pressable>
  )}
/>


      <View style={{ height: 12 }} />
      <Button title="Close" onPress={() => setSearchPickVisible(false)} />
    </View>
  </View>
</Modal>

{/* Premium Modal */}
<Modal visible={!FREE_MODE && premiumVisible} animationType="fade" transparent>  <View style={styles.modalOverlay}>
    <View style={styles.premiumModalBox}>
      <LinearGradient
        colors={["rgba(253,230,138,0.22)", "rgba(34,211,238,0.10)", "rgba(2,6,23,0.98)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.premiumHeader}
      >
        <Text style={styles.premiumHeaderTitle}>Premium</Text>
        <Text style={styles.premiumHeaderSub}>
          Choose a plan • unlock all benefits
        </Text>
      </LinearGradient>

      <ScrollView
  style={{ marginTop: 12 }}
  contentContainerStyle={{ paddingBottom: 8 }}
  showsVerticalScrollIndicator={false}
>
  {/* PLANS */}
  <View style={styles.premiumCard}>
    <View style={styles.premiumCardTitleRow}>
      <Text style={styles.premiumCardTitle}>Plans</Text>
      <Text style={styles.premiumTinyHint}>Tap to activate</Text>
    </View>

    {PREMIUM_PLANS.map((p) => (
      <TouchableOpacity
        key={p.key}
        activeOpacity={0.9}
        onPress={() => upgradeToPremium(p)}
        disabled={premiumBusy}
        style={[styles.premiumPlanRowDark, { opacity: premiumBusy ? 0.6 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.premiumPlanLabelDark}>{p.label}</Text>
            {p.days >= 30 && (
              <View style={styles.premiumChip}>
                <Text style={styles.premiumChipText}>BEST</Text>
              </View>
            )}
          </View>

          <Text style={styles.premiumPlanMetaDark}>
            Save {savingsPct(p.days, p.price)}% • ${(p.price / p.days).toFixed(2)}/day
          </Text>
        </View>

        <Text style={styles.premiumPlanPriceDark}>${p.price}</Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* BENEFITS */}
  <View style={[styles.premiumCard, { marginTop: 12 }]}>
    <View style={styles.premiumCardTitleRow}>
      <Text style={styles.premiumCardTitle}>Benefits</Text>
      <Text style={styles.premiumTinyHint}>Included</Text>
    </View>

    {PREMIUM_BENEFITS.map((b) => (
      <View key={b.key} style={styles.premiumBenefitRow}>
        <View style={styles.premiumBenefitLeft}>
          <Text style={styles.premiumBenefitIcon}>{b.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumBenefitTitle}>{b.title}</Text>
            <Text style={styles.premiumBenefitDesc}>{b.desc}</Text>
          </View>
        </View>

        <Text style={styles.premiumBenefitCheck}>✓</Text>
      </View>
    ))}
  </View>
</ScrollView>


      <TouchableOpacity
        onPress={() => setPremiumVisible(false)}
        disabled={premiumBusy}
        activeOpacity={0.9}
        style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", opacity: premiumBusy ? 0.7 : 1 }}
      >
        <LinearGradient
          colors={["#FDE68A", "#F59E0B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumCloseBtn}
        >
          <Text style={styles.premiumCloseBtnText}>
            {premiumBusy ? "Activating..." : "Close"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

<Modal visible={iapDiagVisible} transparent animationType="fade">
  <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 16 }}>
    <View style={{ backgroundColor: "#0b1120", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", maxHeight: "80%" }}>
      <Text style={{ color: "#fff", fontWeight: "900", marginBottom: 10 }}>IAP Logs</Text>

      <ScrollView style={{ maxHeight: 420, marginBottom: 12 }}>
        <Text selectable style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 16 }}>
          {iapDiagText}
        </Text>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={clearIapDiag} style={{ flex: 1, padding: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "900" }}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIapDiagVisible(false)} style={{ flex: 1, padding: 12, borderRadius: 999, backgroundColor: "#6366f1", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "900" }}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* 🎁 Gift Modal */}
<Modal visible={giftVisible} transparent animationType="fade">
  <View style={styles.giftOverlay}>
    <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />

    <View style={styles.giftModalBox}>
      <LinearGradient
        colors={["rgba(34,211,238,0.20)", "rgba(236,72,153,0.18)", "rgba(2,6,23,0.98)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.giftModalGrad}
      >
        <View style={styles.giftHeaderRow}>
          <View>
            <Text style={styles.giftTitle}>Gifts</Text>
            <Text style={styles.giftSub}>
              Tap a gift to {isPremiumActive ? "send" : "preview"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setGiftVisible(false)}
            style={styles.giftClose}
            activeOpacity={0.85}
          >
            <Text style={styles.giftCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>

      <FlatList
  key={`giftgrid-${giftCols}`}        // ✅ forces fresh render when columns change
  data={GIFTS}
  keyExtractor={(it) => it.id}
  numColumns={giftCols}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingTop: 14, paddingBottom: 18 }}
  columnWrapperStyle={giftCols > 1 ? { paddingHorizontal: 6 } : undefined}
  renderItem={({ item }) => (
    <Pressable
      onPress={() => sendGift(item)}
      style={({ pressed }) => [
        styles.giftTile,
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.giftTileInner}>
        <Image source={item.img} style={styles.giftImg} />
        <View style={styles.giftNamePill}>
          <Text style={styles.giftNameText} numberOfLines={1}>{item.name}</Text>
        </View>
      </View>
    </Pressable>
  )}
/>

      </LinearGradient>
    </View>
  </View>
</Modal>


      </View>
  </ScrollView>





<View style={styles.fixedButtons} pointerEvents="box-none">
  <View style={styles.likeStack}>


  <Animated.View
  style={[
    styles.likeContainer,
    { transform: [{ translateX: HEART_DX }, { translateY: likeY }, { rotate: likeR }] },
  ]}
>

    <TouchableOpacity onPress={handleLike} style={styles.iconWrap}>
      <View style={styles.whiteCircle}>
        <Text style={styles.modernHeart}>❤︎</Text>
      </View>
    </TouchableOpacity>
  </Animated.View>


    {/* SUPER LIKE (modern shiny) */}
  <TouchableOpacity
  onPress={handleSuperLike}
    ref={superLikeBtnRef}
  onLayout={updateSuperLikeDelta}

  
  style={[
    styles.superLikeAbsolute,
    {
      transform: [
        ...superLikeAbsStyle.transform, // keep your DX/DY
        { translateX: superLikeMoveX },
        { translateY: superLikeMoveY },

        { translateY: superLikePopY },
        { scale: superLikeScale },
        
      ],
    },
  ]}
  activeOpacity={0.9}
>


    <LinearGradient
      colors={["rgba(255,244,204,1)", "rgba(245,158,11,1)", "rgba(180,83,9,1)"]}

      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.superLikeCircle, superLikeCircleStyle]}
    >
      {/* animated ring glow */}
      <Animated.View
        pointerEvents="none"
        style={[styles.superLikeRing, { opacity: premiumRingOpacity }]}
      />

      {/* shine sweep */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.superLikeShine,
          { opacity: premiumShineOpacity, transform: [{ translateX: premiumSweepX }, { rotate: "-20deg" }] },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.75)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

<Text style={styles.superLikeIconText}>👍</Text>

      <Text style={styles.superLikeLabel}>SUPER</Text>
    </LinearGradient>
  </TouchableOpacity>

</View>


  {/* PASS (X stays exactly where it was) */}
<View style={[styles.passStack, { transform: [{ translateX: PASS_DX }] }]}>
  <TouchableOpacity onPress={handlePass} style={styles.iconWrap}>
    <View style={styles.whiteCirclePass}>
      <Text style={styles.modernX}>✕</Text>
    </View>
  </TouchableOpacity>

  {/* GIFT (cinematic, mirrored like Super Like but on PASS side) */}
  <TouchableOpacity
    onPress={handleGift}
    style={[styles.giftAbsolute, giftAbsStyle]}
    activeOpacity={0.9}
  >
    <LinearGradient
      colors={["rgba(34,211,238,1)", "rgba(236,72,153,1)", "rgba(88,28,135,1)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.giftCircle, giftCircleStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.giftRing, { opacity: premiumRingOpacity }]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.giftShine,
          {
            opacity: premiumShineOpacity,
            transform: [{ translateX: premiumSweepX }, { rotate: "-20deg" }],
          },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.75)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Text style={[styles.giftIcon, giftIconStyle]}>🎁</Text>
      <Text style={styles.giftLabel}>GIFT</Text>
    </LinearGradient>
  </TouchableOpacity>
</View>

</View>



<Modal visible={chatReqVisible} transparent animationType="fade">
  
  <View style={cr.overlay}>
    <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />

    <View style={cr.box}>
      <LinearGradient
        colors={["rgba(255,182,193,0.60)", "rgba(199,210,254,0.45)", "rgba(15,23,42,1)"]}


        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cr.grad}
      >

      

<Text style={cr.kicker}>🌹 Send chat request</Text>














<Text style={cr.subGold}>
 Want instant chat? Go Premium → Direct inbox.
</Text>



        <Pressable onPress={() => chatReqInputRef.current?.focus()} style={cr.inputWrap}>

          <TextInput
            ref={chatReqInputRef}

            value={chatReqMsg}
            onChangeText={setChatReqMsg}
            placeholder="Say hi — keep it sweet 😊"

            placeholderTextColor="rgba(255,255,255,0.75)"
            cursorColor="rgba(255,255,255,0.95)"
            selectionColor="rgba(255,255,255,0.35)"



            underlineColorAndroid="transparent"
            maxLength={60}
            style={cr.input}
          />
          <Text pointerEvents="none" style={cr.count}>{(chatReqMsg || "").length}/60</Text>

        </Pressable>

        <View style={cr.btnRow}>
          <TouchableOpacity
            onPress={() => { setChatReqVisible(false); setChatReqMsg(""); }}
            style={cr.btnGhost}
            activeOpacity={0.9}
          >
            <Text style={cr.btnGhostText}>Cancel</Text>

          </TouchableOpacity>

          <TouchableOpacity
            onPress={sendChatRequest}
            disabled={sendingChatReq}
            style={[cr.btnPrimary, { opacity: sendingChatReq ? 0.6 : 1 }]}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["rgba(255,182,193,0.95)", "rgba(99,102,241,0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={cr.btnPrimaryGrad}
            >
              <Text style={cr.btnPrimaryText}>{sendingChatReq ? "Sending…" : "Send request"}</Text>



            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
  onPress={() => { setChatReqVisible(false); setChatReqMsg(""); }}
  style={cr.closeBtn}
  activeOpacity={0.85}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Text style={cr.closeBtnTxt}>✕</Text>
  <Text style={cr.closeLbl}>Close</Text>
</TouchableOpacity>

      </LinearGradient>
    </View>
  </View>
</Modal>

{/* NEW: romantic “request sent” screen */}
<Modal visible={chatReqSentVisible} transparent animationType="fade">
  <View style={cr.overlay}>
    <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />

    <View style={cr.box}>
      <LinearGradient
        colors={["rgba(34,211,238,0.50)", "rgba(255,182,193,0.55)", "rgba(15,23,42,1)"]}

        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cr.grad}
      >


        <Text style={cr.sentIcon}>💌</Text>
        <Text style={cr.title}>Request sent</Text>
        <Text style={cr.sub}>
  Sent to <Text style={{ fontWeight: "900" }}>{chatReqSentName}</Text>.
  {"\n"}It’s now pending in their Requests until they accept.
</Text>


        <TouchableOpacity
  onPress={() => setChatReqSentVisible(false)}
  style={[cr.btnPrimary, { width: "100%", marginTop: 12 }]}
  activeOpacity={0.9}
>
  <LinearGradient
    colors={["rgba(99,102,241,0.95)", "rgba(34,211,238,0.85)"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={cr.btnPrimaryGrad}
  >
    <Text style={cr.btnPrimaryText}>Keep swiping</Text>

  </LinearGradient>
</TouchableOpacity>

<TouchableOpacity
  onPress={() => setChatReqSentVisible(false)}
  style={cr.closeBtn}
  activeOpacity={0.85}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Text style={cr.closeBtnTxt}>✕</Text>
  <Text style={cr.closeLbl}>Close</Text>

        </TouchableOpacity>
      </LinearGradient>
    </View>
  </View>
</Modal>

<Modal visible={directMsgVisible} transparent animationType="fade">
  <View style={dm.overlay}>
    <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />

    <View style={dm.box}>
      <LinearGradient
        colors={["rgba(255,204,51,0.35)", "rgba(99,102,241,0.35)", "rgba(15,23,42,1)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={dm.grad}
      >
        <Text style={dm.kickerSub}>Premium perk: message instantly — shoot your shot 💛</Text>




        <Pressable onPress={() => directMsgInputRef.current?.focus()} style={dm.inputWrap}>
          <TextInput
            ref={directMsgInputRef}
            value={directMsgText}
            onChangeText={setDirectMsgText}
            placeholder="Write a message…"
            placeholderTextColor="rgba(255,255,255,0.75)"
            cursorColor="rgba(255,255,255,0.95)"
            underlineColorAndroid="transparent"
            maxLength={500}
            style={dm.input}
            multiline
          />
        </Pressable>

        <View style={dm.btnRow}>
          <TouchableOpacity
            onPress={() => { setDirectMsgVisible(false); setDirectMsgText(""); }}
            style={dm.btnGhost}
            activeOpacity={0.9}
            disabled={sendingDirectMsg}
          >
            <Text style={dm.btnGhostText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={sendDirectInboxMessage}
            style={[dm.btnPrimary, { opacity: sendingDirectMsg ? 0.6 : 1 }]}
            activeOpacity={0.9}
            disabled={sendingDirectMsg}
          >
            <LinearGradient
              colors={["rgba(255,204,51,0.95)", "rgba(199,151,0,0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={dm.btnPrimaryGrad}
            >
              <Text style={dm.btnPrimaryText}>{sendingDirectMsg ? "Sending…" : "Send"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  </View>
</Modal>


<MatchPopup
  visible={matchPopup.visible}
  userA={matchPopup.me}
  userB={matchPopup.them}
  onClose={() => {
  setMatchPopup({ ...matchPopup, visible: false });
  nextUser();   // ✅ move to next person after closing popup
}}

/>

    </View>



 {noMatches && (
      <BlurView
        intensity={110}
        tint="light"
        style={StyleSheet.absoluteFillObject}
      >
        <View style={styles.noMatchOverlayBox}>
          <Text style={styles.noMatchTitle}>No matches with your filters</Text>
          <Text style={styles.noMatchText}>
            Try resetting or adjusting your filters to see more people 💕
          </Text>

          <View style={styles.noMatchButtonsRow}>
            <TouchableOpacity
              onPress={resetSwipes}
              style={styles.noMatchPrimaryBtn}
            >
              <Text style={styles.noMatchPrimaryText}>Reset swipes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearFilters}
              style={styles.noMatchSecondaryBtn}
            >
              <Text style={styles.noMatchSecondaryText}>Reset filters</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.noMatchButtonsRow, { marginTop: 10 }]}>
            <TouchableOpacity
              onPress={() => {
                setNoMatches(false);
                setFilterVisible(true);
              }}
              style={styles.noMatchSecondaryBtn}
            >
              <Text style={styles.noMatchSecondaryText}>Change filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    )}

   {profileLocked && (
  <BlurView
    intensity={110}
    tint="dark"
    pointerEvents="auto"
    style={[StyleSheet.absoluteFillObject, { zIndex: 999999 }]}
  >
    <View style={styles.lockOverlayBox}>
      <Text style={styles.lockTitle}>Finish your profile first</Text>
      <Text style={styles.lockText}>Complete your profile to unlock matches 💕</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={[styles.noMatchPrimaryBtn, { backgroundColor: PALETTE.accent }]}
        >
          <Text style={styles.noMatchPrimaryText}>Go to Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => fetchProfiles()}
          style={styles.noMatchSecondaryBtn}
        >
          <Text style={styles.noMatchSecondaryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  </BlurView>
)}
      </View>

  </LinearGradient>
);
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
  fontSize: 16,
  fontWeight: "700",
  color: "#111827",
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  backgroundColor: "#ffffff",
  marginVertical: 5,
},
inputAndroid: {
  fontSize: 16,
  fontWeight: "700",
  color: "#111827",
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  backgroundColor: "#ffffff",
  marginVertical: 5,
},

  placeholder: {
    color: '#888',
  },
});



const SCREEN_WIDTH = Dimensions.get('window').width;
const UI_SCALE = 1.08; // 1.00 normal • 1.10 bigger • 0.95 smaller


// --- Super Like tuning (move + resize) ---
const SUPERLIKE_SIZE = 54;        // circle diameter
const SUPERLIKE_DX = -37;           // + right, - left
const SUPERLIKE_DY = -34;           // + down,  - up
const SUPERLIKE_ICON_SIZE = 18;   // star size

const HEART_SIZE = 76;     // heart circle size
const PASS_SIZE  = 76;     // x circle size

const HEART_DX = 44;        // move heart left/right
const PASS_DX  = -30;        // move x left/right

// --- Premium badge tuning (move + resize) ---
const PREMIUM_BADGE_W = 130;   // width
const PREMIUM_BADGE_H = 219;   // height
const PREMIUM_BADGE_DX = -182;   // + right, - left    
const PREMIUM_BADGE_DY = -130;   // + down,  - up

// --- Golden Messenger (icon-only) tuning ---
const INBOX_ICON_SIZE = 56; // icon size
const INBOX_DX = -2;         // + right, - left
const INBOX_DY = -23;         // + down,  - up




const superLikeAbsStyle = {
  // overrides styles.superLikeAbsolute.transform (was hardcoded) :contentReference[oaicite:1]{index=1}
  transform: [
    { translateX: -(SUPERLIKE_SIZE / 2) + SUPERLIKE_DX },
    { translateY: SUPERLIKE_DY },
  ],
};

const superLikeCircleStyle = {
  width: SUPERLIKE_SIZE,
  height: SUPERLIKE_SIZE,
  borderRadius: SUPERLIKE_SIZE / 2,
};

const superLikeIconStyle = {
  fontSize: SUPERLIKE_ICON_SIZE,
};

// NEW (brighter details card + glow)
// NEW (details sections use same bg, no visible box)
// NEW PALETTE (same as glowing Details box)
const PALETTE = {
  bgFrom:"#020617",
  bgMid:"#0b1120",
  bgTo:"#1f2937",

  cardFrom:"rgba(30,41,59,0.98)",    // slate-800
  cardTo:"rgba(15,23,42,0.98)",      // slate-900

  extraFrom:"rgba(15,23,42,0.98)",
  extraTo:"rgba(15,23,42,0.90)",

  overlayMid:"rgba(15,23,42,0.45)",
  overlayBottom:"rgba(15,23,42,0.96)",

  accent:"#6366f1",
  accentSoft:"#22d3ee",
  accentText:"#e5e7eb",
};

const WHITE_CIRCLE_BASE = {
  backgroundColor: 'rgba(15,23,42,0.92)',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: 'rgba(99,102,241,0.95)',
  shadowColor: '#22d3ee',
  shadowOpacity: 0.9,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 14 },
  elevation: 22,
};

const styles = StyleSheet.create({
 container: {
  width: "100%",
  alignItems: "stretch",
  paddingHorizontal: 0,
  paddingBottom: 40,
  paddingTop: 0,
  backgroundColor: "transparent",
},

giftTitle: {
  fontSize: 22,
  fontWeight: "900",
  color: "#22d3ee", // bright cyan
  textShadowColor: "rgba(34,211,238,0.95)",
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 14,
  letterSpacing: 0.4,
},

inboxIconOnly: {
  width: 46,
  height: 46,
  borderRadius: 23,
  paddingHorizontal: 0,
  paddingVertical: 0,
},

inboxIconOnlyGradient: {
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.65)",
  shadowColor: "#F59E0B",
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 14,
},

activeFilterLabel: {
  fontSize: 16,
  fontWeight: "900",
  color: "#111827",
  marginTop: 18,
  marginLeft: 10,
},

activeFilterPickWrap: {
  borderWidth: 2,
  borderColor: "#F59E0B",
  borderRadius: 14,
  padding: 2,
  marginTop: 6,
  shadowColor: "#F59E0B",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
},

posterNamePremium: {
  fontSize: 26,
  fontWeight: "900",
  letterSpacing: 0.6,
  textShadowColor: "rgba(0,0,0,0.9)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
},

premiumNameUnderBadge: {
  marginTop: 6,
  alignSelf: "flex-end",
  fontSize: 13,
  fontWeight: "900",
  letterSpacing: 0.4,
  textShadowColor: "rgba(0,0,0,0.85)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
  opacity: 0.95,
},

premiumGlow: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 10,
  borderColor: "rgba(253,230,138,0.10)",
  shadowColor: "#FDE68A",
  shadowOpacity: 0.22,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 16 },
  elevation: 10,
},

premiumStroke: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 3,
  borderColor: "rgba(253,230,138,0.70)",
},

premiumEdgeShine: {
  position: "absolute",
  top: -30,
  bottom: -30,
  width: 90,
  left: -90,
  borderLeftWidth: 3,
  borderRightWidth: 3,
  borderColor: "transparent",
},

featuredPremiumBadgeImg: {
  width: 28,
  height: 28,
  resizeMode: "contain",
},


posterTagWrap: {
  position: "relative",
  alignItems: "flex-end",
},

featuredPremiumBadge: {
  position: "absolute",
  top: -42,
  right: 15,
  zIndex: 50,
  elevation: 50,
  resizeMode: "contain",
},

featuredPremiumBadgeRing: {
  width: 46,
  height: 46,
  borderRadius: 23,
  padding: 2,
  shadowColor: "#F59E0B",
  shadowOpacity: 0.45,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 18,
},

featuredPremiumBadgeInner: {
  flex: 1,
  borderRadius: 21,
  backgroundColor: "rgba(2,6,23,0.86)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
},

featuredPremiumBadgeText: {
  fontSize: 9,
  fontWeight: "900",
  letterSpacing: 1.6,
  color: "rgba(253,230,138,0.98)",
  textShadowColor: "rgba(0,0,0,0.80)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
},

featuredPremiumBadgeShine: {
  position: "absolute",
  top: -14,
  bottom: -14,
  width: 34,
  left: -34,
},


featuredPremiumBadgeWrap: {
  position: "absolute",
  top: -42,
  right: 15,
  zIndex: 50,
  elevation: 50,
  overflow: "hidden",
  borderRadius: 18, // tweak if you want sharper/rounder
},

featuredPremiumBadgeImgFill: {
  width: "100%",
  height: "100%",
  resizeMode: "contain",
},

premiumFreeBanner: {
  position: "absolute",

  // ✅ MOVE IT (free control)
  top: 73,  //+ lower   - up
  left: 5,    //-left   + up
  // right: 11,   // uncomment to anchor to right instead of left

  // ✅ SIZE IT (free control)
  width: 130,      // slimmer horizontally -> smaller number
  // minWidth: 160,
  // maxWidth: 260,
  height: 38,      // slimmer vertically -> smaller number

  zIndex: 10001,
  justifyContent: "center",   // centers text inside fixed height

  // ✅ INTERNAL SPACING (slimmer feel)
  paddingHorizontal: 10,
  paddingVertical: 4,

  borderRadius: 14,
  backgroundColor: "rgba(2,6,23,0.92)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.55)",
  shadowColor: "#FDE68A",
  shadowOpacity: 0.25,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 14,
},


premiumFreeBannerTitle: {
  color: "#FDE68A",
  fontWeight: "900",
  fontSize: 12,
  letterSpacing: 0.2,
},
premiumFreeBannerSub: {
  marginTop: 2,
  color: "rgba(255,255,255,0.85)",
  fontWeight: "800",
  fontSize: 10,
},


badgeShimmer: {
  position: "absolute",
  top: -30,
  bottom: -30,
  width: 60,
  left: -60,
  opacity: 0.95,
},

badgeGlow: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 18,
  backgroundColor: "rgba(253,230,138,0.22)",
},

premiumBadge: {
  position: "absolute",
  top: 14,
  left: 14,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
  backgroundColor: "rgba(2,6,23,0.70)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.45)",
  overflow: "hidden",
},

premiumBadgeText: {
  fontSize: 11,
  fontWeight: "900",
  letterSpacing: 1.2,
  color: "rgba(253,230,138,0.98)",
},


premiumFrameWrap: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 0, // photoBox is full width; keep 0
  overflow: "hidden",
  zIndex: 20,
},

premiumFrameStroke: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 3,
  borderColor: "transparent",
  borderRadius: 0,
},

premiumFrameRing: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 6,
  borderColor: "rgba(253,230,138,0.55)",
  borderRadius: 0,
},

premiumFrameShine: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 90,
  left: -90,
},

premiumGlow: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 10,
  borderColor: "rgba(253,230,138,0.14)",
  shadowColor: "#FDE68A",
  shadowOpacity: 0.25,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 16 },
  elevation: 10,
},

premiumBadge: {
  position: "absolute",
  top: 14,
  left: 14,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
  backgroundColor: "rgba(2,6,23,0.70)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.45)",
  overflow: "hidden",
},

premiumBadgeText: {
  fontSize: 11,
  fontWeight: "900",
  letterSpacing: 1.2,
  color: "rgba(253,230,138,0.98)",
},

premiumBadgeShine: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 50,
  left: -50,
},

superLikeIconText: {
  fontSize: SUPERLIKE_ICON_SIZE + 6,
  color: "#ffffff",
  fontWeight: "900",
  marginTop: -2,
  textShadowColor: "rgba(0,0,0,0.60)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
},



closeBtn: {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 50,
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.14)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.22)",
},
closeBtnTxt: { color: "#fff", fontSize: 18, fontWeight: "900", lineHeight: 18 },
closeLbl: { marginTop: 2, color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 11 },




giftOverlay: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 14,
  backgroundColor: "rgba(0,0,0,0.55)",
},
giftModalBox: {
  width: "96%",          // ✅ was 92%
  maxHeight: "88%",      // ✅ was 78%
  borderRadius: 28,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
  backgroundColor: "rgba(2,6,23,0.96)",
  shadowColor: "#22d3ee",
  shadowOpacity: 0.22,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 16 },
  elevation: 24,
},

giftModalGrad: {
  padding: 18,
},
giftHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
giftTile: {
  flex: 1,
  margin: 8,             // ✅ was 6 (breathing room)
  borderRadius: 22,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.22)",
  backgroundColor: "rgba(255,255,255,0.06)",
  aspectRatio: 1,
},

giftSub: {
  marginTop: 4,
  fontSize: 12,
  fontWeight: "700",
  color: "rgba(255,255,255,0.70)",
},
giftClose: {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.10)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
},
giftCloseTxt: { color: "#fff", fontSize: 18, fontWeight: "900" },

giftTile: {
  flex: 1,
  margin: 6,
  borderRadius: 20,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.22)",
  backgroundColor: "rgba(255,255,255,0.06)",
  aspectRatio: 1,
},
giftTileInner: { flex: 1, justifyContent: "center", alignItems: "center" },
giftImg: { width: "86%", height: "86%", resizeMode: "contain" }, // ✅ was 78%

giftNamePill: {
  position: "absolute",
  bottom: 10,
  left: 6,
  right: 6,
  paddingVertical: 5,
  paddingHorizontal: 8,
  borderRadius: 999,
  backgroundColor: "rgba(15,23,42,0.75)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},

giftNameText: {
  color: "rgba(255,255,255,0.92)",
  fontSize: 12,          // ✅ was 10
  fontWeight: "900",
  textAlign: "center",
  letterSpacing: 0,
  includeFontPadding: false,
},



premiumPillAction: {
  backgroundColor: "transparent",
  paddingHorizontal: 0,
  paddingVertical: 0,
  borderWidth: 0,
  shadowOpacity: 0,
  elevation: 0,
  borderRadius: 16,
  overflow: "hidden",
},


premiumPillGradient: {
  maxWidth: 135,          // ✅ horizontal size (smaller number = narrower)
  paddingHorizontal: 8,   // ✅ horizontal inner padding
  paddingVertical: 9,     // ✅ vertical inner padding (height)
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "rgba(17,24,39,0.18)",
  overflow: "hidden",
},



premiumPillLabel: {
  fontSize: 11,      // ✅ text size (smaller = more compact)
  lineHeight: 13,    // ✅ controls vertical tightness
  fontWeight: "800",
  color: "rgba(17,24,39,0.92)",
  letterSpacing: 0.2,
  textAlign: "center",
  flexShrink: 1,
},

premiumPillTextWrap: {
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},

premiumPillTitle: {
  fontSize: 12,
  lineHeight: 12,
  fontWeight: "900",
  letterSpacing: 0.8,
  color: "rgba(17,24,39,0.95)",
},

premiumPillFreeChip: {
  paddingHorizontal: 10,
  paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: "rgba(15,23,42,0.22)",
  borderWidth: 1,
  borderColor: "rgba(15,23,42,0.18)",
},

premiumPillFreeChipText: {
  fontSize: 14,
  lineHeight: 10,
  fontWeight: "900",
  letterSpacing: 1.2,
  color: "#FFFFFF",                 // ✅ bright
  textShadowColor: "rgba(0,0,0,0.60)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
},

premiumShineRing: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 16,
 borderWidth: 3,
 borderColor: "rgba(255,255,255,0.92)",

},

premiumShineOverlay: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 16,
},
premiumSunGlare: {
  position: "absolute",
  top: -10,
  left: -12,
  width: 52,
  height: 52,
  borderRadius: 26,
  backgroundColor: "rgba(255,255,255,0.28)",
},


 // NEW (match dark / indigo-cyan look)
topAction: {
  position: "absolute",
  top: 26,
  zIndex: 9999,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "rgba(15,23,42,0.96)",           // dark pill
  shadowColor: "#22d3ee",                           // cyan glow
  shadowOpacity: 0.45,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.75)",            // slate border
},

  topActionLeft: {
    left: 18,
  },
  topActionRight: {
    right: 18,
  },
  topActionHigher: {
  top: 5, // was 26 on topAction; smaller = higher
},
posFilters: { top: 7, left: 18 }, // tweak filter button
posMenu: { top: 7, right: 18 },   // tweak report button
menuBtn: { paddingHorizontal: 14, paddingVertical: 1 }, // tweak
posPremium: { top: 40, left: 1 }, // tweak (if under Filters)
msgAction: {    //request button
  position: "absolute",
  display: "none",   //I hide the chat request button for now
  top: 95,     // chat request + down   - up
  right: 225,   // + left  - right
  zIndex: 10000,
},



topActionIcon: {
  fontSize: 18,
  fontWeight: "700",
  color: "#e5e7eb",                                  // light text
},
  topActionLabel: {
  marginLeft: 6,
  fontSize: 13,
  fontWeight: "600",
  color: "#cbd5f5",                                  // soft indigo
  letterSpacing: 0.3,
},

  nearbyRow: {
    marginTop: 14,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },


  menuInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
menuBadge: {
  width: 7,
  height: 7,
  borderRadius: 4,
  backgroundColor: "#22d3ee",                        // tiny cyan dot
},
  
modernChat: {
  fontSize: 40,
  color: "#22d3ee",
  fontWeight: "700",
  marginTop: -2,
  textShadowColor: "rgba(15,23,42,1)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
},


// NEW profileCard (boxed, same color/glow as first design)
profileCard:{
  width:"92%",
  alignSelf:"center",
  borderRadius:24,
  paddingVertical:18,
  paddingHorizontal:20,
  marginTop:-4,
  marginBottom:24,
  backgroundColor:"transparent",
  overflow:"hidden",
  borderWidth:1,
  borderColor:"rgba(148,163,184,0.55)",
  shadowColor:"#22d3ee",
  shadowOpacity:0.45,
  shadowRadius:24,
  shadowOffset:{width:0,height:14},
  elevation:18,
},
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1b1338",
  },
  profileAge: {
    fontSize: 22,
    fontWeight: "600",
    color: "#7b61ff",
  },
  profileLocation: {
    marginTop: 4,
    fontSize: 14,
    color: "#5f5f71",
  },
  profileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(123,97,255,0.15)",
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7b61ff",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  profileBio: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: "#38384a",
  },
  profileBioPlaceholder: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: "#a0a0b2",
    fontStyle: "italic",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    marginRight: 8,
    marginBottom: 6,
  },
  pillIcon: {
    marginRight: 4,
    fontSize: 14,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#40315f",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  metaItem: {
    flex: 1,
    marginRight: 8,
  },
 metaLabel: {
  fontSize: 11,
  textTransform: "uppercase",
  color: "#bfdbfe",                 // light blue
  letterSpacing: 0.7,
},
metaValue: {
  marginTop: 3,
  fontSize: 13,
  fontWeight: "600",
  color: "#e5e7eb",                 // almost white
},

profileHint: {
  marginTop: 14,
  fontSize: 12,
  textAlign: "center",
  color: "#93c5fd",                 // light, readable
},

lockOverlayBox: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 30,
  backgroundColor: 'rgba(0,0,0,0.25)', // give contrast
},

posterOverlay: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 230,            // was 190
  paddingHorizontal: 20,
  paddingBottom: 22,
  justifyContent: "flex-end",
},

posterTitleRow: {
  flexDirection: "row",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: 8,
},
posterName: {
  fontSize: 26,
  fontWeight: "800",
  color: "#ffffff",
  letterSpacing: 0.5,
  textShadowColor: "rgba(0,0,0,0.85)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
},
posterAge: {
  fontSize: 22,
  fontWeight: "600",
  color: "#ffb4e6",
},
posterLocation: {
  marginTop: 4,
  fontSize: 14,
  color: "#f2e7ff",
  textShadowColor: "rgba(0,0,0,0.8)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},

activityRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 6,
  backgroundColor: 'rgba(34,197,94,0.14)',
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: 'rgba(74,222,128,0.28)',
},

activityDot: {
  width: 12,
  height: 12,
  borderRadius: 6,
  marginRight: 8,
  backgroundColor: '#22c55e',
  borderWidth: 1.5,
  borderColor: '#ffffff',
},

activityText: {
  fontSize: 15,
  fontWeight: '800',
  color: '#dcfce7',
  textShadowColor: 'rgba(0,0,0,0.65)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},

posterTag: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  
  backgroundColor: "rgba(123, 97, 255, 0.75)",
},
posterTagText: {
  fontSize: 11,
  fontWeight: "700",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: 1,
},
posterBio: {
  marginTop: 6,
  fontSize: 14,
  lineHeight: 19,
  color: "#fcefff",
  textShadowColor: "rgba(0,0,0,0.8)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},
detailsTitle: {
  fontSize: 13,
  fontWeight: "700",
  color: "#e0f2fe",                 // bright cyan
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
},
placeholderText: {
  fontSize: 14,
  color: "#c2bcff",
},

lockTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
lockText:  { fontSize: 14, color: '#e5e7eb', textAlign: 'center' },



noMatchOverlayBox: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 30,
  backgroundColor: 'rgba(255,255,255,0.2)',
  backgroundColor: 'transparent',   // ⬅️ was rgba(...)

},
noMatchTitle: {
  fontSize: 22,
  fontWeight: '700',
  color: '#1b1338',
  marginBottom: 8,
  textAlign: 'center',
},
noMatchText: {
  fontSize: 14,
  color: '#555',
  textAlign: 'center',
  marginBottom: 20,
},
noMatchButtonsRow: {
  flexDirection: 'row',
  marginTop: 10,
},
noMatchPrimaryBtn: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: PALETTE.accent,   // was "#7b61ff"
  marginRight: 10,
},
noMatchPrimaryText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 14,
},
noMatchSecondaryBtn: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: 'white',
  borderWidth: 1,
  borderColor: '#ddd',
},
noMatchSecondaryText: {
  color: '#1b1338',
  fontWeight: '600',
  fontSize: 14,
},

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: -15,
    left: 0,
    paddingHorizontal: 20
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'monospace',
    color: '#333',
    letterSpacing: -2,
    marginTop: -4,
    marginLeft: -10
  },

whiteCirclePass: {
  width: PASS_SIZE,
  height: PASS_SIZE,
  borderRadius: PASS_SIZE / 2,
  ...WHITE_CIRCLE_BASE,
},



whiteCircleSmall: {
  width: 72,
  height: 72,
  borderRadius: 36,
  backgroundColor: 'rgba(15,23,42,0.9)',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: 'rgba(148,163,184,0.95)',     // bright slate ring
  shadowColor: '#22d3ee',
  shadowOpacity: 0.75,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 20,
},

whiteCircle: {
  width: HEART_SIZE,
  height: HEART_SIZE,
  borderRadius: HEART_SIZE / 2,
  ...WHITE_CIRCLE_BASE,
},

whiteCirclePass: {
  width: PASS_SIZE,
  height: PASS_SIZE,
  borderRadius: PASS_SIZE / 2,
  ...WHITE_CIRCLE_BASE,
},


modernHeart: {
  fontSize: 56,
  color: "#22d3ee",
  fontWeight: '700',
  marginTop: -2,
  textShadowColor: "rgba(15,23,42,1)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
},
modernX: {
  fontSize: 50,
  color: "#a5b4fc",
  fontWeight: '700',
  marginTop: -2,
  textShadowColor: "rgba(15,23,42,1)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
},


iconWrap: {
  justifyContent: 'center',
  alignItems: 'center',
},

fixedButtons: {
  position: "absolute",
  top: "70%",     // a bit lower, floating over the poster
  left: 0,
  right: 0,
  flexDirection: "row",
  justifyContent: "space-around",
  zIndex: 999,
  alignItems: "center",

},

likeStack: {
  width: HEART_SIZE,
height: HEART_SIZE,

  alignItems: "center",
  justifyContent: "center",
  overflow: "visible",
},

likeContainer: {
  position: "relative",   // anchor for the absolute super-like
  overflow: "visible",
},

superLikeAbsolute: {
  position: "absolute",
  bottom: -42,
  left: "50%",
  zIndex: 50,
  elevation: 50,
},



superLikeCircle: {
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
  borderWidth: 2,
  borderColor: "rgba(253,230,138,0.95)",
shadowColor: "#F59E0B",

  shadowOpacity: 0.95,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 14 },
  elevation: 28,
},

superLikeIcon: {
  fontWeight: "900",
  color: "#ffffff",
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
  marginTop: -2,
},


superLikeLabel: {
  position: "absolute",
  bottom: 8,
  fontSize: 9,
  fontWeight: "900",
  letterSpacing: 1.4,
 
  color: "rgba(253,230,138,0.98)",
  backgroundColor: "rgba(15,23,42,0.78)",

  paddingHorizontal: 7,
  paddingVertical: 2,
  borderRadius: 999,
  overflow: "hidden",
},

superLikeRing: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 999,
  borderWidth: 3,
  borderColor: "rgba(253,230,138,0.95)",

},

superLikeShine: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 60,
  left: -60,
},



  filterIconOnPhoto: {
  position: 'absolute',
  top: 20,
  right: 20,
  zIndex: 999,
},




photoBox: {
  width: SCREEN_WIDTH,
  height: 520,
  alignSelf: "center",
  borderRadius: 0,
  overflow: "hidden",
  marginTop: 0,
  marginBottom: 0,
  backgroundColor: "#05020f",
  shadowColor: "#000",
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
},



photo: {
  width: "100%",
  height: "100%",
  resizeMode: "cover",
},
  
 placeholder: {
  width: 250,
  height: 250,
  borderRadius: 24,
  backgroundColor: "rgba(255,255,255,0.05)",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 50,
  marginBottom: 20,
},

  name: { fontSize: 22, fontWeight: 'bold', marginTop: -15 },
  bio: { fontSize: 16, textAlign: 'center', marginVertical: 10, color: '#555', width: '90%' },
buttonRow: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  width: '80%',
  marginTop: -20,   // move down
  // marginTop: -20 // move up
},
  iconImg: {
  width: 90,
  height: 90,
},

info: {
  fontSize: 20,
  fontWeight: '600',
  color: '#333',
  marginVertical: 6,
  textAlign: 'center',
},


passBtn: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: '#808080',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 7,   // ↓ bring X button down
  //marginLeft: 20,   // ← move horizontally
  marginRight: -20,

},


likeBtn: {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: '#ff006e',
  justifyContent: 'center',
  alignItems: 'center',
},

  extraRow: {
    paddingVertical: 4,
  },
// NEW extra photo backgrounds (same dark family as MainScreen)
extraPhotoWrapper: {
  marginRight: 10,
  borderRadius: 18,
  overflow: 'hidden',
  backgroundColor: 'rgba(15,23,42,0.90)',
},
  extraPhoto: {
    width: 72,
    height: 96,
    borderRadius: 18,
  },
// NEW extraSection (matches boxed look)
extraSection:{
  width:SCREEN_WIDTH,
  alignSelf:"center",
  borderRadius:24,
  paddingVertical:16,
  paddingHorizontal:14,
  marginTop:-10,
  marginBottom:24,
  backgroundColor:"transparent",
  shadowColor:"#000",
  shadowOpacity:0.35,
  shadowRadius:14,
  elevation:10,
},

screenBg: {
  flex: 1,
},


msgHit: {
  borderRadius: 16,
},
msgPill: {
  width: 128,
  height: 23,
  borderRadius: 16,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(34,211,238,0.70)",

  justifyContent: "center",
  paddingHorizontal: 12,
  shadowColor: "#22d3ee",
  shadowOpacity: 0.55,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 14,
},
msgRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},

filtersBtn: { paddingHorizontal: 10, paddingVertical: 2 }, // tweak

msgIcon: {
  fontSize: 16,
},
msgLabel: {
  fontSize: 11,
  fontWeight: "700",
  letterSpacing: 1.2,
  color: "#e0f2fe",
},
msgHalo: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(99,102,241,0.40)",
  borderStyle: "dashed",
  opacity: 0.9,
},
msgScan: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 70,
  left: -70,
  opacity: 0.45,

},

premiumBtnHit: { marginTop: 14, marginHorizontal: 6 },
premiumBtn: {
  borderRadius: 18,
  paddingVertical: 14,
  paddingHorizontal: 14,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(15,23,42,0.18)",
},
premiumBtnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
premiumBtnIcon: { fontSize: 18 },
premiumBtnText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.2, color: "#111827" },
premiumPill: {
  marginLeft: "auto",
  backgroundColor: "rgba(15,23,42,0.18)",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
},
premiumPillText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1, color: "#111827" },
premiumTriangle: {
  position: "absolute",
  right: -18,
  top: 0,
  bottom: 0,
  width: 0,
  height: 0,
  borderTopWidth: 28,
  borderBottomWidth: 28,
  borderLeftWidth: 18,
  borderTopColor: "transparent",
  borderBottomColor: "transparent",
  borderLeftColor: "rgba(251,146,60,0.98)",
},

premiumTitle: { fontSize: 18, fontWeight: "900", color: "#111827", letterSpacing: 0.6 },
premiumSub: { marginTop: 6, color: "rgba(17,24,39,0.75)", fontWeight: "600" },
premiumPlanRow: {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.55)",
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 12,
  marginBottom: 10,
  backgroundColor: "rgba(255,255,255,0.65)",
},
premiumPlanLabel: { fontSize: 14, fontWeight: "900", color: "#111827" },
premiumPlanMeta: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "rgba(17,24,39,0.65)" },
premiumPlanPrice: { fontSize: 16, fontWeight: "900", color: "#111827" },

premiumAction: {
  position: "absolute",
  top: 74,     // under filter (filter is top: 26)
  left: 18,
  zIndex: 10000,
},

premiumModalBox: {
  width: "92%",
  maxHeight: "84%",
  borderRadius: 26,
  padding: 14,
  overflow: "hidden",
  backgroundColor: "rgba(2,6,23,0.98)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.22)",
  shadowColor: "#F59E0B",
  shadowOpacity: 0.22,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 16 },
  elevation: 22,
},
premiumHeader: {
  borderRadius: 20,
  paddingVertical: 14,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.22)",
},
premiumHeaderTitle: {
  fontSize: 20,
  fontWeight: "900",
  color: "#fff",
  letterSpacing: 0.4,
},
premiumHeaderSub: {
  marginTop: 4,
  fontSize: 12,
  fontWeight: "700",
  color: "rgba(255,255,255,0.75)",
},

premiumGrid: { flexDirection: "row", marginTop: 12 },
premiumCol: { flex: 1 },

premiumCard: {
  borderRadius: 18,
  padding: 12,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.20)",
},
premiumCardTitleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
},
premiumCardTitle: {
  fontSize: 12,
  fontWeight: "900",
  letterSpacing: 1.1,
  color: "rgba(255,255,255,0.90)",
  textTransform: "uppercase",
},
premiumTinyHint: {
  fontSize: 11,
  fontWeight: "800",
  color: "rgba(255,255,255,0.55)",
},

premiumPlanRowDark: {
  flexDirection: "row",
  alignItems: "center",
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 12,
  marginBottom: 10,
  backgroundColor: "rgba(15,23,42,0.80)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.18)",
},
premiumPlanLabelDark: { fontSize: 14, fontWeight: "900", color: "#fff" },
premiumPlanMetaDark: { marginTop: 2, fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.65)" },
premiumPlanPriceDark: { fontSize: 16, fontWeight: "900", color: "#FDE68A" },

premiumChip: {
  marginLeft: 8,
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: "rgba(253,230,138,0.16)",
  borderWidth: 1,
  borderColor: "rgba(253,230,138,0.35)",
},
premiumChipText: { fontSize: 10, fontWeight: "900", color: "#FDE68A", letterSpacing: 0.8 },

premiumBenefitRow: {
  flexDirection: "row",
  alignItems: "center",
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginBottom: 10,
  backgroundColor: "rgba(15,23,42,0.62)",
  borderWidth: 1,
  borderColor: "rgba(34,211,238,0.18)",
},
premiumBenefitLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
premiumBenefitIcon: { fontSize: 16, marginRight: 10 },
premiumBenefitTitle: { fontSize: 13, fontWeight: "900", color: "#fff" },
premiumBenefitDesc: { marginTop: 1, fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
premiumBenefitCheck: { fontSize: 16, fontWeight: "900", color: "#22d3ee" },

premiumCloseBtn: {
  paddingVertical: 12,
  alignItems: "center",
  justifyContent: "center",
},
premiumCloseBtnText: {
  color: "rgba(17,24,39,0.95)",
  fontWeight: "900",
  letterSpacing: 0.3,
},


posInbox: { top: 500, right: 8 },   // - higher  + lower

inboxPillAction: {
  backgroundColor: "transparent",
  paddingHorizontal: 0,
  paddingVertical: 0,
  borderWidth: 0,
  shadowOpacity: 0,
  elevation: 0,
  borderRadius: 16,
  overflow: "hidden",
},
inboxPillGradient: {
  paddingHorizontal: 12,
  paddingVertical: 2,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "rgba(17,24,39,0.18)",
  overflow: "hidden",
},
inboxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
inboxIcon: { fontSize: 14 },
inboxLabel: {
  fontSize: 13,
  fontWeight: "900",
  color: "rgba(17,24,39,0.92)",
  letterSpacing: 0.2,
},
inboxBadge: {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0b1120",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.55)",
  paddingHorizontal: 5,
},
inboxBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },


  extraHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  extraTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginRight: 8,
  },
 extraDivider: {
  flex: 1,
  height: 1,
  backgroundColor: "rgba(255,255,255,0.14)", // was "#f4dff5"
  borderRadius: 999,
},

  extraGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
 extraThumbWrap: {
  width: "48%",
  borderRadius: 18,
  overflow: "hidden",
  marginBottom: 12,
  backgroundColor: "rgba(15,23,42,0.90)",
},
  extraThumb: {
    width: "100%",
    height: 170,
    resizeMode: "cover",
  },

extraBigPhotoBox: {
  width: "100%",
  height: 460,
  borderRadius: 0,
  overflow: "hidden",
  marginBottom: 0,
  backgroundColor: "rgba(15,23,42,0.96)",
},

extraBigPhoto: {
  width: "100%",
  height: "100%",
  resizeMode: "cover",
},

searchBtn: {
  alignSelf: "flex-end",
  marginRight: 10,
  marginTop: 4,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "rgba(99,102,241,0.14)",
  borderWidth: 1,
  borderColor: "rgba(99,102,241,0.45)",
},
searchBtnText: {
  color: "#111827",
  fontWeight: "900",
  fontSize: 12,
},
searchInput: {
  marginTop: 10,
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: "#ffffff",
  color: "#111827",
  fontWeight: "700",
},
searchItem: {
  paddingVertical: 12,
  paddingHorizontal: 10,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(148,163,184,0.35)",
},
searchItemText: {
  color: "#111827",
  fontWeight: "700",
},

fauxPick: {
  marginVertical: 5,
  marginHorizontal: 0,
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  backgroundColor: "#ffffff",
},
fauxPickText: {
  fontSize: 16,
  fontWeight: "700",
  color: "#111827",
},
fauxPickPlaceholder: {
  color: "#94a3b8",
},



  end: { flex: 1, textAlign: 'center', marginTop: 100, fontSize: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
 // FILTER MODAL ------------- NEW (much brighter, high contrast)
modalOverlay:{flex:1,backgroundColor:'rgba(15,23,42,0.35)',justifyContent:'center',alignItems:'center'},
// NEW (light slate, softly matching match screen bg)
// NEW (solid very light slate, softly matching match bg)
modalBox:{width:'88%',maxHeight:'80%',backgroundColor:'#e5ecff',borderRadius:24,overflow:'hidden',padding:18,borderWidth:1,borderColor:'rgba(148,163,184,0.9)',shadowColor:'#0f172a',shadowOpacity:0.3,shadowRadius:20,shadowOffset:{width:0,height:10},elevation:18},label:{marginTop:14,fontWeight:'700',color:'#111827',marginLeft:10},

passStack: {
  width: PASS_SIZE,
  height: PASS_SIZE,
  alignItems: "center",
  justifyContent: "center",
  overflow: "visible",
  position: "relative",
},

giftAbsolute: {
  position: "absolute",
  bottom: -42,
  left: "50%",
  zIndex: 60,
  elevation: 60,
},

giftCircle: {
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
  borderWidth: 2,
  borderColor: "rgba(236,72,153,0.85)",
  shadowColor: "#22d3ee",
  shadowOpacity: 0.9,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 14 },
  elevation: 28,
},

giftIcon: {
  fontWeight: "900",
  color: "#ffffff",
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
  marginTop: -2,
},

giftLabel: {
  position: "absolute",
  bottom: 8,
  fontSize: 9,
  fontWeight: "900",
  letterSpacing: 1.4,
  color: "rgba(255,255,255,0.92)",
  backgroundColor: "rgba(15,23,42,0.78)",
  paddingHorizontal: 7,
  paddingVertical: 2,
  borderRadius: 999,
  overflow: "hidden",
},

giftRing: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 16, // ✅ match button corners
  borderWidth: 3,
  borderColor: "rgba(255,255,255,0.22)",
},


giftShine: {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 60,
  left: -60,
},


});

function MatchPopup({ visible, userA, userB, onClose }) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.loop(
          Animated.timing(rotate, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          })
        ),
      ]).start();
    }
  }, [visible]);


  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade">
      <View style={mp.overlay}>
        <Animated.View style={[mp.ring, { transform: [{ rotate: spin }, { scale }] }]} />

        <Animated.View style={[mp.box, { transform: [{ scale }] }]}>
          <LinearGradient colors={[PALETTE.accentSoft, PALETTE.accent]} style={mp.grad}
>

            <Text style={mp.title}>✨ It’s a Match ✨</Text>

            <View style={mp.row}>
              <Image source={{ uri: userA }} style={mp.pic} />
              <Image source={{ uri: userB }} style={mp.pic} />
            </View>

            <Text style={mp.sub}>you both liked each other 💜</Text>
          </LinearGradient>
        </Animated.View>

        <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
          <Text style={mp.close}>close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const mp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.25)",
  },
  box: {
    width: 280,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 20,
  },
  grad: { padding: 25, alignItems: "center" },
  title: { fontSize: 28, color: "white", fontWeight: "900", marginBottom: 10 },
  row: { flexDirection: "row", gap: 20, marginTop: 10 },
  pic: {
    width: 85,
    height: 85,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "white",
  },
  sub: { color: "white", marginTop: 10, fontSize: 15 },
  close: { color: "white", fontSize: 16 },
});

const dm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  box: {
    width: 340,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,1)",
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#FFCC33",
    shadowOpacity: 0.25,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 22,
  },
  grad: { width: "100%", padding: 18, alignItems: "center" },
  kicker: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontSize: 12,
  },

  kickerSub: {
  marginTop: 6,
  color: "rgba(255,255,255,0.82)",
  fontWeight: "800",
  fontSize: 13,
  textAlign: "center",
  lineHeight: 18,
},

  inputWrap: {
    width: "100%",
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.90)",
  },
  input: {
    width: "100%",
    color: "#fff",
    fontSize: 15,
    backgroundColor: "transparent",
    minHeight: 90,
  },
  btnRow: { flexDirection: "row", width: "100%", marginTop: 14 },
  btnGhost: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  btnGhostText: { color: "rgba(255,255,255,0.86)", fontWeight: "800" },
  btnPrimary: { flex: 1, borderRadius: 999, overflow: "hidden" },
  btnPrimaryGrad: { paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: "#0b1120", fontWeight: "900", letterSpacing: 0.2 },
});


const cr = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  box: {
    width: 340,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,1)",
    borderColor: "rgba(255,255,255,0.28)",    shadowColor: "#ffb6c1",
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 22,
  },
  grad: {
  width: "100%",
  padding: 18,
  alignItems: "center",
},

  kicker: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
  },

 subGold: {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 18,
  color: "#FFCC33",            // ✅ same gold as your pill
  textAlign: "center",
  fontWeight: "900",
  textShadowColor: "#C99700",  // ✅ deeper gold
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
},



 inputWrap: {
  width: "100%",
  marginTop: 14,
  borderRadius: 18,
  paddingHorizontal: 14,
  paddingVertical: 12,
  backgroundColor: "rgba(0,0,0,0.55)",      // clearly different from window
  borderWidth: 2,                            // stronger edge
  borderColor: "rgba(255,255,255,0.90)",     // bright outline
},


input: {
  width: "100%",
  color: "#fff",
  fontSize: 15,
  paddingVertical: 0,     // prevents inner dark block look
  paddingHorizontal: 0,
  backgroundColor: "transparent",
},
  count: {
    marginTop: 6,
    alignSelf: "flex-end",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 14,
  },
  btnGhost: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  btnGhostText: {
    color: "rgba(255,255,255,0.86)",
    fontWeight: "800",
  },
  btnPrimary: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  btnPrimaryGrad: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#0b1120",
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  sentIcon: { fontSize: 44, marginTop: 2 },

  closeBtn: {
  marginTop: 14,
  alignSelf: "center",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: "rgba(15,23,42,0.55)",
  borderWidth: 1,
  borderColor: "rgba(34,211,238,0.55)",
  shadowColor: PALETTE.accentSoft,
  shadowOpacity: 0.7,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 16,
},
closeBtnTxt: { color: "#fff", fontSize: 18, fontWeight: "900", lineHeight: 18 },
closeLbl: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },

});
