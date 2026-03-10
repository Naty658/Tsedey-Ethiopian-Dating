import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
//import LinearGradient from 'react-native-linear-gradient';
import { LinearGradient } from 'expo-linear-gradient';

import auth from '@react-native-firebase/auth';
import CountryPicker from 'react-native-country-picker-modal';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCK_KEY = '@login_lock_v1';


const showAuthError = (e) => {
  Alert.alert('Send code failed', `${e?.code || ''}\n${e?.message || 'Unknown error'}`);
};

const digits = (v) => String(v || '').replace(/[^\d]/g, '');

const normalizePhone = (cc, p) => {
  const a = digits(cc), b = digits(p);
  if (!a || !b) return '';
  return `+${a}${b}`;
};

const getServerFirst = async (refOrQuery) => {
  try {
    return await refOrQuery.get({ source: 'server' });
  } catch {
    return await refOrQuery.get();
  }
};

const findUidByPhone = async (fullPhone) => {
  const d = digits(fullPhone);
  const idxCol = firestore().collection('phoneIndex');

  // 1) phoneIndex doc keys
  const keysToTry = [d, fullPhone, fullPhone.replace('+', '')];
  for (const k of keysToTry) {
    const snap = await getServerFirst(idxCol.doc(k));
    if (snap.exists) {
      const uid = snap.data()?.uid || null;
      if (uid) return { uid };
      return { uid: null };
    }
  }

  // 2) phoneIndex queries (if allowed)
  try {
    const qs = await getServerFirst(idxCol.where('phoneDigits', '==', d).limit(1));
    if (!qs.empty && qs.docs[0].data()?.uid) return { uid: qs.docs[0].data().uid };
  } catch {}

  try {
    const qs = await getServerFirst(idxCol.where('phone', '==', fullPhone).limit(1));
    if (!qs.empty && qs.docs[0].data()?.uid) return { uid: qs.docs[0].data().uid };
  } catch {}

  // 3) fallback: users collection + repair index
  const users = firestore().collection('users');

  try {
    const qs = await getServerFirst(users.where('phoneDigits', '==', d).limit(1));
    if (!qs.empty) {
      const uid = qs.docs[0].id;
      await idxCol.doc(d).set({ uid, phone: fullPhone, phoneDigits: d }, { merge: true });
      return { uid };
    }
  } catch {}

  try {
    const qs = await getServerFirst(users.where('phone', '==', fullPhone).limit(1));
    if (!qs.empty) {
      const uid = qs.docs[0].id;
      await idxCol.doc(d).set({ uid, phone: fullPhone, phoneDigits: d }, { merge: true });
      return { uid };
    }
  } catch {}

  return { uid: null };
};


export default function ForgotPasswordScreen({ navigation }) {
const [phone, setPhone] = useState('');
const [countryCode, setCountryCode] = useState('US');
const [callingCode, setCallingCode] = useState('1');

const onSelectCountry = (country) => {
  setCountryCode(country.cca2);
  setCallingCode(country.callingCode[0]);
};

/*
const normalizePhone = (callingCode, phone) =>
  `+${callingCode}${String(phone || '').replace(/[^\d]/g, '')}`;
*/

const handleSendCode = async () => {
  const fullPhone = normalizePhone(callingCode, phone);
  const phoneKey = digits(fullPhone);

  if (phoneKey.length < 8) {
    Alert.alert('Invalid phone', 'Please enter a valid phone number.');
    return;
  }

  try {
    const found = await findUidByPhone(fullPhone);

    if (!found.uid) {
      Alert.alert('No account found', 'No account found with that phone number.');
      return;
    }

    /*
    if (__DEV__) {
      auth().settings.appVerificationDisabledForTesting = true;
    }
*/
    const confirmation = await auth().signInWithPhoneNumber(fullPhone);

   navigation.navigate('VerifyCode', {
  mode: 'reset',
  expectedUid: found.uid,
  verificationId: confirmation.verificationId,
  phone: fullPhone,
  phoneKey,
  confirmation,
  unlockAfterReset: true,
  lockKeyToClear: LOCK_KEY,
});
  } catch (e) {
    Alert.alert('Error', `${e?.code || ''} ${e?.message || 'Failed to send code. Try again.'}`.trim());
  }
};





  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.bg}>
        <View style={styles.card}>
          <LinearGradient colors={['#e91e63', '#ff9800']} style={styles.titleBox}>
            <Text style={styles.title}>Forgot Password</Text>
          </LinearGradient>

          <Text style={styles.info}>
            Enter your phone number. We’ll text you a verification code to reset your password.

          </Text>

         <View style={styles.phoneRow}>
  <CountryPicker
    countryCode={countryCode}
    withFilter
    withFlag
    withCallingCode
    withEmoji
    onSelect={onSelectCountry}
  />
  <Text style={styles.countryCode}>+{callingCode}</Text>

  <TextInput
    placeholder="Phone number"
    placeholderTextColor="#555"
    style={styles.phoneInput}
    value={phone}
    onChangeText={setPhone}
    keyboardType="phone-pad"
  />
</View>


          <TouchableOpacity onPress={handleSendCode}>
            <LinearGradient colors={['#3f51b5', '#673ab7']} style={styles.button}>
              <Text style={styles.buttonText}>Send Code </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.back}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8', // ☁️ soft matte white
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  titleBox: {
    alignSelf: 'center',
    borderRadius: 10,
    paddingHorizontal: 25,
    paddingVertical: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  info: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  back: {
    color: '#3f51b5',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
  },
  phoneRow: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#ddd',
  paddingHorizontal: 12,
  paddingVertical: 6,
  marginBottom: 15,
},
countryCode: {
  marginLeft: 8,
  marginRight: 8,
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
},
phoneInput: {
  flex: 1,
  fontSize: 16,
  paddingVertical: 8,
  color: '#000',
},

});