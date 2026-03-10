import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import CountryPicker from 'react-native-country-picker-modal';

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

export default function SignupScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [callingCode, setCallingCode] = useState('1');
  const [loading, setLoading] = useState(false);

  const onSelectCountry = (country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
  };

  const handleSignup = async () => {
    const fullPhone = normalizePhone(callingCode, phone);
    const phoneKey = digits(fullPhone);

    if (phoneKey.length < 8) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }

    try {
      setLoading(true);

      // ✅ server-first + try multiple keys (same as your smaller version)
      const idxCol = firestore().collection('phoneIndex');
      const keysToTry = [phoneKey, fullPhone, fullPhone.replace('+', '')];

      let takenByUid = null;
      for (const k of keysToTry) {
        const s = await getServerFirst(idxCol.doc(k));
        if (s.exists && s.data()?.uid) {
          takenByUid = s.data().uid;
          break;
        }
      }
      if (takenByUid) {
        Alert.alert('Phone already in use', 'That phone is linked to another account.');
        return;
      }

      // ✅ no signOut here (same as smaller)
      const confirmation = await auth().signInWithPhoneNumber(fullPhone);

      navigation.navigate('VerifyCode', {
        mode: 'signup',
        phone: fullPhone,
        phoneKey,
        verificationId: confirmation.verificationId,
        confirmation, // keep for compatibility if your VerifyCode uses it
      });
    } catch (e) {
      if (e?.code === 'auth/too-many-requests') {
        Alert.alert('Please wait', 'You requested too many codes, try again in a bit.');
        return;
      }
      Alert.alert('Failed to send code', e?.message || 'Try again');
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
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to receive a one-time SMS code.
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
                placeholderTextColor="#888"
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? '...' : 'Send Code'}</Text>
            </TouchableOpacity>

            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              Already have an account? Login
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// styles unchanged...
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(8, 10, 24, 0.9)',
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 20, 50, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  countryCode: { color: '#ffd1e8', fontWeight: '600', marginRight: 8, fontSize: 16 },
  input: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 16 },
  button: { backgroundColor: '#ff4b8a', borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 16, color: '#d3c8ff', fontSize: 14 },
});
