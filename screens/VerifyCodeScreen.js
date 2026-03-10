// screens/VerifyCodeScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';


const digits = (v) => String(v || '').replace(/[^\d]/g, '');

const getServerFirst = async (refOrQuery) => {
  try {
    return await refOrQuery.get({ source: 'server' });
  } catch {
    return await refOrQuery.get();
  }
};

const ensurePhoneIndex = async (fullPhone, uid) => {
  const d = digits(fullPhone);
  const ref = firestore().collection('phoneIndex').doc(d);

  await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) {
      tx.set(
        ref,
        { uid, phone: fullPhone, phoneDigits: d, createdAt: firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      return;
    }
    const existingUid = doc.data()?.uid;
    if (existingUid && existingUid !== uid) throw new Error('PHONE_ALREADY_IN_USE');
  });

  return d;
};

export default function VerifyCodeScreen({ route, navigation }) {
  const {
    phone,
    phoneKey,
    mode,
    verificationId,
    expectedUid,
    uid: resetUid,          // older long param
    confirmation,           // older long param
  } = route.params || {};

  const vId = verificationId || confirmation?.verificationId;
  const expected = expectedUid || resetUid;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const completedRef = useRef(false);
  const clearLoginLockIfNeeded = async () => {
  if (route.params?.unlockAfterReset) {
    await AsyncStorage.removeItem(route.params?.lockKeyToClear || '@login_lock_v1');
  }
};

  const cleanupTempPhoneUser = async () => {
    try {
      const u = auth().currentUser;
      if (u) await u.delete();
    } catch {}
    try {
      await auth().signOut();
    } catch {}
  };

  // ✅ cleanup temp phone user if backing out during signup/reset
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (completedRef.current) return;
      if (mode !== 'signup' && mode !== 'reset') return;

      e.preventDefault();
      (async () => {
        await cleanupTempPhoneUser();
        navigation.dispatch(e.data.action);
      })();
    });

    return unsub;
  }, [navigation, mode]);

  const cleanupAndExit = async (msg) => {
    await cleanupTempPhoneUser();
    Alert.alert('Stopped', msg);
    navigation.goBack();
  };

  const handleVerify = async () => {
    if (loading) return;

    const c = code.trim();
    if (c.length !== 6) return Alert.alert('Invalid code', 'Please enter the 6-digit code.');
    if (!vId) return Alert.alert('Error', 'Missing verification. Please request a new code.');

    setLoading(true);
    try {
      // keep your LINK flow, but align phoneIndex key to digits
      if (mode === 'link') {
        const emailUser = auth().currentUser;
        if (!emailUser) {
          Alert.alert('Error', 'Please login again.');
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }

        const phoneCred = auth.PhoneAuthProvider.credential(vId, c);

        try {
          await emailUser.linkWithCredential(phoneCred);
        } catch (e) {
          if (e?.code === 'auth/credential-already-in-use') {
            Alert.alert('Phone already in use', 'That phone is linked to another account.');
            return;
          }
          if (e?.code === 'auth/provider-already-linked') {
            Alert.alert('Already linked', 'This account already has a phone linked.');
            return;
          }
          throw e;
        }

        const linkedPhone = emailUser.phoneNumber || phone;
        if (!linkedPhone) return Alert.alert('Error', 'Missing phone number.');

        const d = await ensurePhoneIndex(linkedPhone, emailUser.uid);

        await firestore().collection('users').doc(emailUser.uid).set(
          { phone: linkedPhone, phoneDigits: d, phoneVerified: true },
          { merge: true }
        );

        completedRef.current = true;
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        return;
      }

      // ✅ SIGNUP / RESET uses short logic (credential + signInWithCredential)
      const cred = auth.PhoneAuthProvider.credential(vId, c);
      const res = await auth().signInWithCredential(cred);
      const uid = res.user?.uid;
      if (!uid) return cleanupAndExit('Missing user session.');

      const phoneNumber = res.user?.phoneNumber || phone;
      if (!phoneNumber) return cleanupAndExit('Missing phone number.');

      const d = phoneKey || digits(phoneNumber);

      if (mode === 'reset') {
        if (!expected) return cleanupAndExit('Account not found.');
        if (uid !== expected) return cleanupAndExit('This phone is not linked to that account.');
        await clearLoginLockIfNeeded();
        completedRef.current = true;
        return navigation.replace('CreatePassword', { mode: 'reset', phone: phoneNumber, phoneKey: d });
      }

      if (mode === 'signup') {
        const idxRef = firestore().collection('phoneIndex').doc(d);
        const idx = await getServerFirst(idxRef);

        if (idx.exists && idx.data()?.uid && idx.data()?.uid !== uid) {
          return cleanupAndExit('Phone already in use.');
        }

        const batch = firestore().batch();
        batch.set(idxRef, { uid, phone: phoneNumber, phoneDigits: d }, { merge: true });
        batch.set(
          firestore().collection('users').doc(uid),
          {
            phone: phoneNumber,
            phoneDigits: d,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await batch.commit();

        completedRef.current = true;
        return navigation.replace('CreatePassword', { mode: 'signup', phone: phoneNumber, phoneKey: d });
      }

      return cleanupAndExit('Invalid flow.');
    } catch (err) {
      Alert.alert('Verification failed', `${err?.code || ''} ${err?.message || 'Invalid code, try again.'}`.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={['#050816', '#140b2a', '#2b061b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              We sent a verification code to{' '}
              <Text style={{ fontWeight: '600', color: '#ffd1e8' }}>{phone}</Text>
            </Text>

            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor="#777"
                value={code}
                onChangeText={setCode}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? '...' : 'Continue'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { /* TODO: resend later */ }}>
              <Text style={styles.resend}>Didn’t get a code? Resend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(8, 10, 24, 0.95)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#b0b0d0', textAlign: 'center', marginBottom: 24 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  codeInput: {
    letterSpacing: 8,
    fontSize: 22,
    textAlign: 'center',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 20, 50, 0.9)',
    minWidth: 160,
  },
  button: {
    backgroundColor: '#ff4b8a',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resend: { textAlign: 'center', marginTop: 14, color: '#d3c8ff', fontSize: 13 },
});
