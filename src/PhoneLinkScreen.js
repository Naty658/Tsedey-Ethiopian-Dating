// screens/PhoneLinkScreen.js (or .tsx)
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
import CountryPicker from 'react-native-country-picker-modal';

const normalizePhone = (callingCode, phone) =>
  `+${callingCode}${String(phone || '').replace(/[^\d]/g, '')}`;

export default function PhoneLinkScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [callingCode, setCallingCode] = useState('1');

  const onSelectCountry = (country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
  };

  const handleSendCode = async () => {
    if (!auth().currentUser) {
      Alert.alert('Not signed in', 'Please login again.');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Phone required', 'Please enter your phone number to continue.');
      return;
    }

    const fullPhone = normalizePhone(callingCode, phone);
    if (fullPhone.length < 8) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }

    try {
      const confirmation = await auth().signInWithPhoneNumber(fullPhone);

      navigation.navigate('VerifyCode', {
        phone: fullPhone,
        confirmation,
        mode: 'link', // 👈 tell VerifyCodeScreen this is linking, not signup
      });
    } catch (err) {
      Alert.alert('Failed to send code', err?.message || 'Try again.');
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
            <Text style={styles.title}>Link your phone</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to receive an SMS code.
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

            <TouchableOpacity style={styles.button} onPress={handleSendCode}>
              <Text style={styles.buttonText}>Send Code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

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
});
