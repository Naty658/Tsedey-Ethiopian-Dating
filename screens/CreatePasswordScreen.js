// screens/CreatePasswordScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';


const digits = (v) => String(v || '').replace(/[^\d]/g, '');

export default function CreatePasswordScreen({ navigation, route }) {
  const { phone, phoneKey, mode = 'signup' } = route.params || {};
  const isReset = mode === 'reset';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const completedRef = useRef(false);
  const cleaningRef = useRef(false);
  const savingRef = useRef(false);

  const cleanupTempSignup = async () => {
    if (cleaningRef.current) return;
    cleaningRef.current = true;

    try {
      const user = auth().currentUser;
      if (!user) return;

      const providerIds = (user.providerData || [])
        .map((p) => p?.providerId)
        .filter(Boolean);

      // only delete if still phone-only (no password provider yet)
      const hasPasswordProvider = providerIds.includes('password');
      if (hasPasswordProvider) return;

      const pk = phoneKey || digits(phone) || digits(user.phoneNumber);
      const uid = user.uid;

      if (uid) await firestore().collection('users').doc(uid).delete().catch(() => {});
      if (pk) await firestore().collection('phoneIndex').doc(pk).delete().catch(() => {});

      await user.delete().catch(() => {});
      await auth().signOut().catch(() => {});
    } finally {
      cleaningRef.current = false;
    }
  };

  // ✅ match short: if user leaves during signup (back/gesture), cleanup temp phone user
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (mode !== 'signup') return;
      if (completedRef.current) return;

      e.preventDefault();
      (async () => {
        await cleanupTempSignup();
        navigation.dispatch(e.data.action);
      })();
    });

    return unsub;
  }, [navigation, mode, phone, phoneKey]);

  const handleContinue = async () => {
    if (savingRef.current || loading) return;
    savingRef.current = true;

    try {
      setError('');

      const user = auth().currentUser;
      if (!user) {
        setError('Not signed in. Please verify your phone again.');
        return;
      }

      // validations (same rules as short)
      const e = email.trim().toLowerCase();
      if (mode === 'signup') {
        if (!e || !e.includes('@')) {
          setError('Please enter a valid email.');
          return;
        }
      }

      if (!password || password.trim() !== password || password.length < 6) {
        setError('Password must be 6+ characters and cannot start/end with spaces.');
        return;
      }

      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }

      const pk = phoneKey || digits(phone) || digits(user.phoneNumber);
      const phoneNumber = phone || user.phoneNumber || null;

      setLoading(true);

      if (mode === 'signup') {
  const providerIds = (user.providerData || []).map((p) => p?.providerId).filter(Boolean);
  const alreadyHasPassword = providerIds.includes('password');

  if (!alreadyHasPassword) {
    const cred = auth.EmailAuthProvider.credential(e, password);
    await user.linkWithCredential(cred);
  }
} else {
  await user.updatePassword(password);
  await AsyncStorage.removeItem('@login_lock_v1');

  const providerIds = (user.providerData || []).map((p) => p?.providerId).filter(Boolean);
  const hasPasswordProvider = providerIds.includes('password');

  if (!hasPasswordProvider) {
    let emailToUse = user.email;
    if (!emailToUse) {
      const snap = await firestore().collection('users').doc(user.uid).get();
      emailToUse = (snap.data()?.email || '').toLowerCase();
    }

    if (!emailToUse) throw new Error('No email on this account (can’t login with email/password).');

    const cred = auth.EmailAuthProvider.credential(emailToUse, password);
    await user.linkWithCredential(cred);
  }
}


      // ✅ match short: Firestore write is best-effort (account still exists if this fails)
      try {
        const batch = firestore().batch();

        batch.set(
          firestore().collection('users').doc(user.uid),
          {
            email: e || user.email || null,

            phone: phoneNumber,
            phoneDigits: pk || null,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (pk) {
          batch.set(
            firestore().collection('phoneIndex').doc(pk),
            { uid: user.uid, phone: phoneNumber, phoneDigits: pk },
            { merge: true }
          );
        }

        await batch.commit();
      } catch {}

      completedRef.current = true;
      // ✅ unlock login ONLY after password is actually set
if (isReset) {
  await AsyncStorage.removeItem('@login_lock_v1');
}

await AsyncStorage.setItem('uid', user.uid);
navigation.replace('Main');
    } catch (e2) {
      setError(e2?.message || 'Failed. Please try again.');
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isReset ? 'Reset your password' : 'Create a password'}</Text>

      {!isReset && (
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      )}

      <View style={styles.passwordRow}>
  <TextInput
    style={[styles.input, { flex: 1, marginBottom: 0 }]}
    placeholder="Password"
    placeholderTextColor="#888"
    secureTextEntry={!showPassword}
    value={password}
    onChangeText={setPassword}
  />
  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.toggleBtn}>
    <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
  </TouchableOpacity>
</View>



      <View style={styles.passwordRow}>
  <TextInput
    style={[styles.input, { flex: 1, marginBottom: 0 }]}
    placeholder="Confirm password"
    placeholderTextColor="#888"
    secureTextEntry={!showConfirm}
    value={confirm}
    onChangeText={setConfirm}
  />
  <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.toggleBtn}>
    <Text style={styles.toggleText}>{showConfirm ? 'Hide' : 'Show'}</Text>
  </TouchableOpacity>
</View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleContinue}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? '...' : 'Continue'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', backgroundColor: '#050816' },
  title: { fontSize: 24, color: '#fff', marginBottom: 24, textAlign: 'center', fontWeight: '600' },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    marginBottom: 12,
  },
  error: { color: '#f97373', marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: '#ec4899', paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backText: { marginTop: 16, textAlign: 'center', color: '#9ca3af' },
  passwordRow: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#111827',
  borderRadius: 10,
  marginBottom: 12,
},
toggleBtn: {
  paddingHorizontal: 12,
  paddingVertical: 12,
},
toggleText: {
  color: '#9ca3af',
  fontWeight: '600',
},

});
