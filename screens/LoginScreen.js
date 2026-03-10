import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ImageBackground,   // 🆕 added
} from 'react-native';
//import LinearGradient from 'react-native-linear-gradient';
import { LinearGradient } from 'expo-linear-gradient';

import * as AppIntegrity from '@expo/app-integrity';

import firestore from '@react-native-firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, Animated } from 'react-native';




const MAX_ATTEMPTS = 5;

function PremiumPopup({ visible, title, message, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!visible) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.popupOverlay} onPress={onClose}>
        <Animated.View style={[styles.popupCard, { opacity: anim, transform: [{ scale }] }]}>
          

          <View style={styles.popupHeader}>
            <View style={styles.popupIconWrap}>
              <LinearGradient
  colors={['#d32f2f', '#7b1fa2']}
  style={styles.popupIcon}
>
                <Text style={styles.popupIconText}>!</Text>
              </LinearGradient>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.popupTitle}>{title}</Text>
              <Text style={styles.popupMessage}>{message}</Text>
            </View>
          </View>

          <View style={styles.popupActions}>
            <Pressable style={{ flex: 1 }} onPress={onClose}>
              <LinearGradient
  colors={['#7870c0ff', '#252908ff']} // slate / charcoal
  style={styles.popupPrimaryBtn}
>
                <Text style={styles.popupPrimaryText}>OK</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function LoginScreen({ navigation }) {

 

 // const [email, setEmail] = useState('');

const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min

const [failedAttempts, setFailedAttempts] = useState(0);
const [lockUntil, setLockUntil] = useState(0); // timestamp (ms)
const [now, setNow] = useState(Date.now());
const LOCK_KEY = '@login_lock_v1';
const [lockEmail, setLockEmail] = useState('');
const CLOUD_PROJECT_NUMBER = '870869933716';

useEffect(() => {
  if (Platform.OS !== 'android' || __DEV__) return;
  AppIntegrity.prepareIntegrityTokenProviderAsync(CLOUD_PROJECT_NUMBER);

}, []);

useEffect(() => {
  (async () => {
    const raw = await AsyncStorage.getItem(LOCK_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    if (saved.lockUntil > Date.now()) {
      setLockUntil(saved.lockUntil);
      setFailedAttempts(saved.failedAttempts || 0);
      setLockEmail(saved.lockEmail || '');
    } else {
      await AsyncStorage.removeItem(LOCK_KEY);
    }
  })();
}, []);

useEffect(() => {
  (async () => {
    if (!lockUntil && !failedAttempts && !lockEmail) {
      await AsyncStorage.removeItem(LOCK_KEY);
      return;
    }
    await AsyncStorage.setItem(
      LOCK_KEY,
      JSON.stringify({ lockUntil, failedAttempts, lockEmail })
    );
  })();
}, [lockUntil, failedAttempts, lockEmail]);

useEffect(() => {
  const unsub = navigation.addListener('focus', () => {
    (async () => {
      // If reset flow cleared the lock key, clear in-memory lock too
      const raw = await AsyncStorage.getItem(LOCK_KEY);
      if (!raw) {
        setLockUntil(0);
        setFailedAttempts(0);
        setLockEmail('');
      }
    })();
  });

  return unsub;
}, [navigation]);



useEffect(() => {
  if (lockUntil === 0) return;
  const t = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(t);
}, [lockUntil]);



/* ADD BELOW */
const [popup, setPopup] = useState({ visible: false, title: '', message: '' });

const showPopup = (title, message) =>
  setPopup({ visible: true, title, message });

const hidePopup = () =>
  setPopup(p => ({ ...p, visible: false }));
  
const formatUnlockTime = (ts) => new Date(ts).toLocaleTimeString();
const lockedActive = now < lockUntil;
const secs = lockedActive ? Math.ceil((lockUntil - now) / 1000) : 0;

const popupMessage =
  lockedActive
    ? `${popup.message ? popup.message + '\n\n' : ''}Try again at ${formatUnlockTime(lockUntil)}\n\n(${secs}s remaining)`
    : popup.message;


const handleLogin = async () => {
  const normalizedEmail = email.trim().toLowerCase();

if (now < lockUntil && normalizedEmail && normalizedEmail === lockEmail) {
  const secs = Math.ceil((lockUntil - now) / 1000);
  showPopup(
    'Temporarily locked',
    `Try again at ${formatUnlockTime(lockUntil)}\n\n(${secs}s remaining)`
  );
  return;
}




  if (!email.trim() || !password.trim()) {
    Alert.alert('Missing info', 'Enter your email and password.');
    return;
  }

  // ✅ ADD THIS RIGHT HERE
  if (password !== password.trim()) {
    Alert.alert("Invalid password", "Password can't start or end with spaces.");
    return;
  }

 
if (Platform.OS === 'android' && !__DEV__) {
  const requestHash = `${normalizedEmail}:${Date.now()}`;
  const integrityResult = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
  await AsyncStorage.setItem('play_integrity_result', JSON.stringify(integrityResult));
}

  try {
   
   const authInstance = getAuth();

const userCred = await signInWithEmailAndPassword(
  getAuth(),
  email.trim().toLowerCase(),
  password // <-- no trim
);


const user = userCred.user;

await AsyncStorage.setItem('uid', user.uid);

  if (!user.phoneNumber) {
  navigation.replace('PhoneLink'); // your phone OTP screen
  return;
}


    // Optional: mark presence online (using UID now)
    await firestore()
      .collection('presence')
      .doc(user.uid)
      .set(
        { online: true, lastSeen: firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

    

    setFailedAttempts(0);
setLockUntil(0);
setLockEmail('');
await AsyncStorage.removeItem(LOCK_KEY);

    navigation.navigate('Main');
  } catch (error) {
  const code = error?.code;

  // Firebase rate-limit
  if (code === 'auth/too-many-requests') {
    const until = Date.now() + COOLDOWN_MS;
    setLockEmail(email.trim().toLowerCase());
    setLockUntil(until);
    showPopup(
      'Temporarily locked',
      `Too many attempts.\nTry again at ${formatUnlockTime(until)}`
    );
    return;
  }

  // Your local wrong-password counter
  const newCount = failedAttempts + 1;
  setFailedAttempts(newCount);

  if (newCount >= MAX_ATTEMPTS) {
    const until = Date.now() + COOLDOWN_MS;
    setLockEmail(email.trim().toLowerCase());
    setLockUntil(until);
    showPopup(
      'Account locked',
      `Too many failed attempts.\nTry again at ${formatUnlockTime(until)}`
    );
    return;
  }

  showPopup('Login failed', 'Wrong email or password.');
}
};

  return (
  <ImageBackground
    source={require('../assets/images/loginBg.png')}
    style={styles.bgImage}
  
    >
      {/* 🆕 Fade bottom half control */}
     <LinearGradient
  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
  start={{ x: 0.5, y: 0.1 }}   // 👈 higher fade start
  end={{ x: 0.5, y: 1 }}
  style={StyleSheet.absoluteFillObject}
/>





      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={['#e91e63', '#ff9800']} style={styles.titleBox}>
            <Text style={styles.title}>Login to Lavish</Text>
          </LinearGradient>

         <TextInput
  placeholder="Email"
  placeholderTextColor="#555"
  style={styles.input}
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  autoCapitalize="none"
/>



          <TextInput
            placeholder="Password"
            placeholderTextColor="#555"
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          
          
          
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text>{showPassword ? "Hide Password" : "Show Password"}</Text>
          </TouchableOpacity>




          <TouchableOpacity onPress={handleLogin} style={{ marginTop: 10 }}>
            <LinearGradient colors={['#3f51b5', '#673ab7']} style={styles.button}>
              <Text style={styles.buttonText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.link}>
              Don’t have an account?{' '}
              <Text style={{ color: '#ff4081', fontWeight: 'bold' }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
     <PremiumPopup
  visible={popup.visible}
  title={popup.title}
  message={popupMessage}
  onClose={hidePopup}
/>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // 🆕 allow image behind
  },
  bgImage: {
    flex: 1,
    resizeMode: 'cover',

  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  titleBox: {
    alignSelf: 'center',
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 10,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  button: {
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgot: {
    color: '#3f51b5',
    textAlign: 'center',
    marginTop: 15,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    marginTop: 15,
    color: '#444',
    fontSize: 16,
  },
  popupOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.89)', // 👈 stronger blur/dim
  },
  popupCard: {
  borderRadius: 22,
  backgroundColor: 'rgba(250,250,252,0.96)', // cooler white
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: 'rgba(123,31,162,0.25)', // subtle violet edge
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 18,
  elevation: 10,
},

  popupAccent: {
    height: 6,
    width: '100%',
  },
  popupHeader: {
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    paddingBottom: 14,
  },
  popupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  popupIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#101114',
    marginBottom: 4,
  },
  popupMessage: {
    fontSize: 14.5,
    lineHeight: 20,
    color: 'rgba(16,17,20,0.72)',
  },
  popupActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 0,
  },
  popupPrimaryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupPrimaryText: {
  color: '#f5f5f5',
  fontSize: 15,
  fontWeight: '800',
  letterSpacing: 0.3,
},
  popupGhostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(16,17,20,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16,17,20,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupGhostText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgba(16,17,20,0.75)',
  },
});