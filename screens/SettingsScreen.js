import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  Switch,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView,
  TextInput,
  Linking,
  Modal,
} from 'react-native';


import AsyncStorage from '@react-native-async-storage/async-storage';


import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '../translations';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';



export default function SettingsScreen() {
  const navigation = useNavigation();
  const [hideProfile, setHideProfile] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [userPhone, setUserPhone] = useState('');
const [userEmail, setUserEmail] = useState('');
const [suggestOpen, setSuggestOpen] = useState(false);
const [suggestText, setSuggestText] = useState('');
const [suggestSending, setSuggestSending] = useState(false);


  
  // put near top of file (inside component is fine)
const runStep = async (label, fn) => {
  try {
    console.log(`➡️ ${label}`);
    const res = await fn();
    console.log(`✅ ${label}`);
    return res;
  } catch (e) {
    console.log(`❌ ${label}`, {
      code: e?.code,
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
    });
    // show which step failed on screen too
    Alert.alert(
      '❌ Delete failed at:',
      `${label}\n\n${e?.code || ''}\n${e?.message || ''}`
    );
    throw e;
  }
};


  useEffect(() => {
    const loadSettings = async () => {
      const hide = await AsyncStorage.getItem('hideProfile');
      if (hide) setHideProfile(JSON.parse(hide));
    };
    loadSettings();

    const u = auth().currentUser;
setUserPhone(u?.phoneNumber || '');
setUserEmail(u?.email || '');

  }, []);

  const isRecentLogin = (u, minutes = 10) => {
  const t = u?.metadata?.lastSignInTime;
  if (!t) return false;
  const ms = Date.now() - new Date(t).getTime();
  return ms >= 0 && ms <= minutes * 60 * 1000;
};

  const saveToggle = async (key, value) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
      await AsyncStorage.clear();
      Alert.alert('✅ Logged out successfully');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      Alert.alert('❌ Logout failed', err.message);
    }
  };

 const handleChangePassword = async () => {
  const user = auth().currentUser;
  if (!user || !user.email) {
    Alert.alert('Error', 'No email user is logged in.');
    return;
  }

  try {
    if (!currentPass || !newPass) {
      Alert.alert('Missing info', 'Enter current and new password.');
      return;
    }

    const cred = auth.EmailAuthProvider.credential(user.email, currentPass);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPass);

    Alert.alert('✅ Password updated successfully');
    setCurrentPass('');
    setNewPass('');
  } catch (err) {
    Alert.alert('❌ Error', err?.message || 'Failed to update password');
  }
};


  

const handleDeleteAccount = async () => {
  Alert.alert(
    'Delete Account',
    'This will permanently remove your profile and preferences.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
  const user = auth().currentUser;
  if (!user) return Alert.alert('Error', 'No authenticated user found.');

 const uid = user.uid;
const phoneNumber = user.phoneNumber || null;
const email = user.email || null;

try {
  await runStep('Reauthenticate (required for delete)', async () => {
  // If they literally just signed up / logged in, Firebase already considers it "recent".
  // This avoids blocking delete with "missing-current-password" right after signup.
  if (isRecentLogin(user, 10)) return;

  // email/password users -> require current password
  if (email) {
    if (!currentPass) {
      throw Object.assign(new Error('Enter your current password, then try delete again.'), {
        code: 'missing-current-password',
      });
    }
    const cred = auth.EmailAuthProvider.credential(email, currentPass);
    await user.reauthenticateWithCredential(cred);
    return;
  }

  // phone/other providers
  throw Object.assign(new Error('Please log out, log in again, then delete immediately.'), {
    code: 'requires-recent-login',
  });
});


  await runStep('Write deletedAccounts audit', () =>
    firestore().collection('deletedAccounts').doc(uid).set({
      uid,
      phone: phoneNumber,
      email,
      deletedAt: firestore.FieldValue.serverTimestamp(),
    })
  );

    const matchSnap = await runStep('Query matches where user is member', () =>
      firestore().collection('matches').where('users', 'array-contains', uid).get()
    );

    for (const d of matchSnap.docs) {
      await runStep(`Delete match ${d.ref.path}`, () => d.ref.delete());
    }

    const chatSnap = await runStep('Query chats where user is member', () =>
      firestore().collection('chats').where('users', 'array-contains', uid).get()
    );

    for (const d of chatSnap.docs) {
      await runStep(`Delete chat ${d.ref.path}`, () => d.ref.delete());
    }

    await runStep(`Delete profiles/${uid}`, () =>
      firestore().collection('profiles').doc(uid).delete()
    );

    await runStep(`Delete users/${uid}`, () =>
      firestore().collection('users').doc(uid).delete()
    );

    const deleteAllInSubcol = async (path) => {
      const snap = await runStep(`Read subcollection ${path}`, () =>
        firestore().collection(path).get()
      );
      for (const docSnap of snap.docs) {
        await runStep(`Delete ${docSnap.ref.path}`, () => docSnap.ref.delete());
      }
    };

    await deleteAllInSubcol(`users/${uid}/likes`);
    await deleteAllInSubcol(`users/${uid}/passes`);

   await runStep('Delete phoneIndex docs for uid', async () => {
  const snap = await firestore().collection('phoneIndex').where('uid', '==', uid).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
});


   await runStep('Delete Auth user', async () => {
  await user.delete();
});


    await AsyncStorage.clear();
    Alert.alert('✅ Account deleted');
    navigation.reset({ index: 0, routes: [{ name: 'Signup' }] });

  } catch (e) {
    // runStep already alerted the exact failing step
  }
}

      },
    ]
  );
};



 const [supportOpen, setSupportOpen] = useState(false);
const [supportText, setSupportText] = useState('');
const [supportSending, setSupportSending] = useState(false);
const [supportCategory, setSupportCategory] = useState('General');

const handleContactSupport = () => {
  setSupportOpen(true);
};

const handleCreateSupportTicket = async () => {
  const user = auth().currentUser;
  const uid = user?.uid || null;

  const text = (supportText || '').trim();
  if (!text) return Alert.alert('Write something', 'Please enter your message.');

  try {
    setSupportSending(true);

    const ref = await firestore().collection('supportTickets').add({
      uid,
      email: user?.email || null,
      phone: user?.phoneNumber || null,
      category: supportCategory,
      message: text,
      status: 'open',
      createdAt: firestore.FieldValue.serverTimestamp(),
      appVersion: null,
      platform: null,
    });

    setSupportText('');
    setSupportOpen(false);
    Alert.alert('✅ Ticket created', `ID: ${ref.id}`);
  } catch (e) {
    Alert.alert('❌ Failed', e?.message || 'Could not create ticket');
  } finally {
    setSupportSending(false);
  }
};


  const handleSendSuggestion = async () => {
  const user = auth().currentUser;
  const uid = user?.uid || null;

  const text = (suggestText || '').trim();
  if (!text) return Alert.alert('Write something', 'Please enter your suggestion.');

  try {
    setSuggestSending(true);
    await firestore().collection('suggestions').add({
      uid,
      email: user?.email || null,
      phone: user?.phoneNumber || null,
      text,
      createdAt: firestore.FieldValue.serverTimestamp(),
      appVersion: null,
      platform: null,
    });

    setSuggestText('');
    setSuggestOpen(false);
    Alert.alert('✅ Sent', 'Thanks for the suggestion!');
  } catch (e) {
    Alert.alert('❌ Failed', e?.message || 'Could not send suggestion');
  } finally {
    setSuggestSending(false);
  }
};


  const handleTerms = () => {
    Alert.alert(
      '📜 Terms & Privacy Policy',
      `Welcome to Lavish, a community built on trust, respect, and genuine connection. Please read this carefully as it explains your rights, our responsibilities, and how we protect your personal data.

By using Lavish, you agree to act responsibly, provide accurate information, and engage respectfully with other members. The purpose of Lavish is to connect people seeking friendship, companionship, or relationships — not to deceive, exploit, or harm others.

🔒 PRIVACY & DATA PROTECTION
Your privacy is our top priority. We collect only the minimum data required to provide core features such as matching, messaging, and profile display. This includes details like your name, email, age, gender, photos, preferences, and basic location information. All personal data is stored securely using encryption and safe database practices. We never sell or rent your personal data to any third party. Your information is used solely to operate and improve the Lavish experience. You can delete your data at any time by removing your account or contacting us directly at datinglavish@gmail.com.

🛡 SECURITY
We use modern security standards to protect all stored and transmitted information. However, you acknowledge that no online system is 100% secure, and by using Lavish you accept the inherent risks of using internet-based services. We continuously monitor and update our systems to maintain security and safeguard your personal information from unauthorized access.

👥 USER CONDUCT
All users must be 18 years or older. You agree not to impersonate another person, misrepresent your identity, harass, threaten, or exploit others. Any abusive behavior, inappropriate content, discrimination, or attempts to scam or harm others will result in immediate suspension or permanent removal from the platform without notice. Respectful and authentic communication is expected at all times.

🚫 PROHIBITED USES
Lavish must not be used for solicitation, advertising, illegal activity, or sharing explicit content. Users are responsible for the content they post or share. We reserve the right to remove any material or profile that violates our standards or harms the community.

🤝 OUR COMMITMENT
We are committed to protecting every user’s safety, privacy, and dignity. Your photos, messages, and preferences remain confidential and are never disclosed publicly beyond what you intentionally share in your profile. We do not use your personal data for external marketing, and we comply with applicable data protection laws and ethical standards.

💬 COMMUNICATION
Lavish may contact you through in-app notifications or email regarding important updates, account alerts, or support messages. You may choose to disable non-essential notifications in your settings.

📩 SUPPORT & DATA REMOVAL
To remove your data, simply go to Settings → Delete Account inside the app.If you need extra help, you can still reach us at datinglavish@gmail.com. We’ll support you quickly and respectfully.

By continuing to use Lavish, you confirm that you have read, understood, and agreed to these Terms & Privacy practices. Our mission is to provide a respectful, secure, and meaningful experience for everyone.`
    );
  };

  const theme = lightStyles;

return (
  <SafeAreaView style={theme.screen}>
    {/* soft top gradient to match main screen */}

    <ScrollView contentContainerStyle={theme.scrollContent}>
      <View style={theme.settingsCard}>
        <Text style={theme.title}>Settings</Text>
     <View style={theme.infoCard}>
  <View style={theme.infoRow}>
    <Text style={theme.infoLabel}>Email</Text>
    <Text style={theme.infoValue}>{userEmail || '—'}</Text>
  </View>

  <View style={theme.divider} />

  <View style={theme.infoRow}>
    <Text style={theme.infoLabel}>Phone</Text>
    <Text style={theme.infoValue}>{userPhone || '—'}</Text>
  </View>
</View>



        {/* ACCOUNT */}
        <Text style={theme.sectionTitle}>Account</Text>
        <View style={theme.sectionCard}>
          <TextInput
            placeholder="Current Password"
            placeholderTextColor="gray"
            value={currentPass}
            onChangeText={setCurrentPass}
            style={theme.input}
          />
          <TextInput
            placeholder="New Password"
            placeholderTextColor="gray"
            value={newPass}
            onChangeText={setNewPass}
            style={theme.input}
          />

          <TouchableOpacity style={theme.primaryButton} onPress={handleChangePassword}>
            <Text style={theme.primaryButtonText}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity style={theme.destructiveButton} onPress={handleDeleteAccount}>
            <Text style={theme.destructiveButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* PRIVACY */}
        <Text style={theme.sectionTitle}>Privacy</Text>
        <View style={theme.sectionCard}>
          <View style={theme.rowPill}>
            <Text style={theme.text}>Hide My Profile</Text>
            <Switch
              value={hideProfile}
              onValueChange={async v => {
                setHideProfile(v);
                await saveToggle('hideProfile', v);
                const uid = await AsyncStorage.getItem('uid');
                if (uid) {
                await firestore().collection('profiles').doc(uid).set({ hidden: v }, { merge: true });
                  }

                

              }}
            />
          </View>
        </View>


        {/* SUPPORT */}
        <Text style={theme.sectionTitle}>Support</Text>
        <View style={theme.sectionCard}>
          <TouchableOpacity style={theme.secondaryButton} onPress={handleContactSupport}>
            <Text style={theme.secondaryButtonText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={theme.secondaryButton} onPress={() => setSuggestOpen(true)}>
            <Text style={theme.secondaryButtonText}>Send a Suggestion</Text>
          </TouchableOpacity>


          <TouchableOpacity style={theme.secondaryButton} onPress={handleTerms}>
            <Text style={theme.secondaryButtonText}>Terms & Privacy Policy</Text>
          </TouchableOpacity>

{/* SUGGESTION MODAL */}
<Modal
  visible={suggestOpen}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (!suggestSending) {
      setSuggestOpen(false);
      setSuggestText('');
    }
  }}
>
  <View style={theme.modalOverlay}>
    <View style={theme.modalCard}>
      <Text style={theme.modalTitle}>Suggestion</Text>
      <Text style={theme.modalSub}>Tell us what you want improved.</Text>

      <TextInput
        value={suggestText}
        onChangeText={setSuggestText}
        placeholder="Write your suggestion..."
        placeholderTextColor="rgba(0,0,0,0.35)"
        style={theme.suggestInput}
        multiline
        maxLength={800}
        textAlignVertical="top"
      />

      <View style={[theme.modalRow, theme.modalActions]}>
        <TouchableOpacity
          style={theme.modalGhostBtn}
          onPress={() => {
            setSuggestOpen(false);
            setSuggestText('');
          }}
          disabled={suggestSending}
        >
          <Text style={theme.modalGhostText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[theme.modalPrimaryBtn, suggestSending && { opacity: 0.7 }]}
          onPress={handleSendSuggestion}
          disabled={suggestSending}
        >
          <Text style={theme.modalPrimaryText}>
            {suggestSending ? 'Sending...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* SUPPORT MODAL */}
<Modal
  visible={supportOpen}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (!supportSending) {
      setSupportOpen(false);
      setSupportText('');
    }
  }}
>
  <View style={theme.modalOverlay}>
    <View style={theme.modalCard}>
      <Text style={theme.modalTitle}>Contact Support</Text>
      <Text style={theme.modalSub}>Create a support ticket.</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {['General', 'Billing', 'Report', 'Bug'].map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setSupportCategory(c)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(103,58,183,0.25)',
              backgroundColor: supportCategory === c ? 'rgba(103,58,183,0.12)' : '#fff',
            }}
            disabled={supportSending}
          >
            <Text style={{ fontWeight: '800', color: '#222' }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        value={supportText}
        onChangeText={setSupportText}
        placeholder="Describe your issue..."
        placeholderTextColor="rgba(0,0,0,0.35)"
        style={theme.suggestInput}
        multiline
        maxLength={1200}
        textAlignVertical="top"
      />

      <View style={[theme.modalRow, theme.modalActions]}>
        <TouchableOpacity
          style={theme.modalGhostBtn}
          onPress={() => {
            setSupportOpen(false);
            setSupportText('');
          }}
          disabled={supportSending}
        >
          <Text style={theme.modalGhostText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[theme.modalPrimaryBtn, supportSending && { opacity: 0.7 }]}
          onPress={handleCreateSupportTicket}
          disabled={supportSending}
        >
          <Text style={theme.modalPrimaryText}>
            {supportSending ? 'Submitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>


{/* SUGGESTION MODAL */}
<Modal
  visible={suggestOpen}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (!suggestSending) {
      setSuggestOpen(false);
      setSuggestText('');
    }
  }}
>
  <View style={theme.modalOverlay}>
    <View style={theme.modalCard}>
      <Text style={theme.modalTitle}>Suggestion</Text>
      <Text style={theme.modalSub}>Tell us what you want improved.</Text>

      <TextInput
        value={suggestText}
        onChangeText={setSuggestText}
        placeholder="Write your suggestion..."
        placeholderTextColor="rgba(0,0,0,0.35)"
        style={theme.suggestInput}
        multiline
        maxLength={800}
        textAlignVertical="top"
      />

      <View style={[theme.modalRow, theme.modalActions]}>
        <TouchableOpacity
          style={theme.modalGhostBtn}
          onPress={() => {
            setSuggestOpen(false);
            setSuggestText('');
          }}
          disabled={suggestSending}
        >
          <Text style={theme.modalGhostText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[theme.modalPrimaryBtn, suggestSending && { opacity: 0.7 }]}
          onPress={handleSendSuggestion}
          disabled={suggestSending}
        >
          <Text style={theme.modalPrimaryText}>
            {suggestSending ? 'Sending...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

</View>
{/* LOGOUT */}
<View style={theme.footerSpace}>
  <TouchableOpacity style={theme.destructiveSoftButton} onPress={handleLogout}>
    <Text style={theme.destructiveSoftButtonText}>Logout</Text>
  </TouchableOpacity>
</View>
</View>
</ScrollView>
</SafeAreaView>
);

}

const baseStyles = {
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 25, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  text: { fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: '#000',
    placeholderTextColor: '#888',
  },
};

const lightStyles = StyleSheet.create({
  ...baseStyles,

  screen: {
    flex: 1,
    backgroundColor: '#f3f0ff',
  },

  container: {
    ...baseStyles.container,
    backgroundColor: 'transparent',
  },

  scroll: {
    backgroundColor: 'transparent',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    ...baseStyles.title,
    fontSize: 26,
    textAlign: 'left',
    marginBottom: 10,
  },

  sectionTitle: {
    ...baseStyles.sectionTitle,
    marginTop: 18,
    marginBottom: 8,
    color: '#555',
  },

  sectionCard: {
    backgroundColor: '#faf8ff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.10)',
  },

  text: {
    ...baseStyles.text,
    color: '#222',
  },

  input: {
    ...baseStyles.input,
    borderColor: 'rgba(103,58,183,0.3)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },

  row: {
    ...baseStyles.row,
  },

  rowPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
  },

  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#673ab7',
    paddingVertical: 10,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  secondaryButton: {
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.35)',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },

  secondaryButtonText: {
    color: '#673ab7',
    fontWeight: '600',
    fontSize: 15,
  },

  destructiveButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#ff5252',
  },

  destructiveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  destructiveSoftButton: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,82,82,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.35)',
  },

  destructiveSoftButtonText: {
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: 15,
  },

  footerSpace: {
    marginTop: 24,
  },

  infoCard: {
  backgroundColor: '#faf8ff',
  borderRadius: 16,
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.12)',
  marginBottom: 12,
},

infoRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

infoLabel: {
  fontSize: 13,
  fontWeight: '800',
  color: '#673ab7',
  letterSpacing: 0.3,
},

infoValue: {
  fontSize: 15,
  fontWeight: '700',
  color: '#222',
  maxWidth: '70%',
  textAlign: 'right',
},

divider: {
  height: 1,
  backgroundColor: 'rgba(0,0,0,0.06)',
  marginVertical: 10,
},

modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.45)',
  justifyContent: 'center',
  paddingHorizontal: 16,
},




modalCard: {
  backgroundColor: '#fff',
  borderRadius: 24,
  paddingTop: 18,
  paddingHorizontal: 18,
  paddingBottom: 18,
  maxHeight: '85%',
},



modalTitle: {
  fontSize: 18,
  fontWeight: '800',
  color: '#222',
},

modalSub: {
  marginTop: 4,
  marginBottom: 10,
  color: 'rgba(0,0,0,0.55)',
  fontWeight: '600',
},

suggestInput: {
  marginTop: 12,
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.25)',
  backgroundColor: 'rgba(103,58,183,0.06)',
  color: '#111',
  minHeight: 220,
},
modalActions: {
  paddingTop: 10,
  marginTop: 10,
},



modalRow: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 12,
},

modalGhostBtn: {
  flex: 1,
  borderRadius: 999,
  paddingVertical: 10,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.10)',
  backgroundColor: '#fff',
},

modalGhostText: {
  color: 'rgba(0,0,0,0.65)',
  fontWeight: '800',
},

modalPrimaryBtn: {
  flex: 1,
  borderRadius: 999,
  paddingVertical: 10,
  alignItems: 'center',
  backgroundColor: '#673ab7',
},

modalPrimaryText: {
  color: '#fff',
  fontWeight: '800',
},

});
