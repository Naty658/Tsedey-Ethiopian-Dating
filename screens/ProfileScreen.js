import 'react-native-get-random-values';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  Image,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Animated,  
  Modal,        // ✅ add this
  FlatList,     // ✅ add this           

} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // ⬅️ add this
import * as Location from 'expo-location';   // 👈 add this

import AsyncStorage from '@react-native-async-storage/async-storage';
//import { launchImageLibrary } from 'react-native-image-picker';
import * as ImagePicker from 'expo-image-picker';


import RNPickerSelect from 'react-native-picker-select';
//import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
//import storage from '@react-native-firebase/storage';  // ✅ keep here
//import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../firebaseConfig';

//import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef } from 'react'; // hooks for animation
import countriesWithCities from '../assets/countriesWithCities.json';

//import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as ImageManipulator from 'expo-image-manipulator';

import auth from '@react-native-firebase/auth';
//import { db, storage } from '../firebaseConfig';

import storage from '@react-native-firebase/storage';
import { logFirebaseErr } from '../src/fbDebug';
import firestore from '@react-native-firebase/firestore';




const pickerStyle = {
  inputIOS: { color: '#000' },
  inputAndroid: { color: '#000' },
};

export default function ProfileScreen() {
  const navigation = useNavigation();

  const avatarScale = useRef(new Animated.Value(0.98)).current;

useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(avatarScale, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(avatarScale, {
        toValue: 0.98,
        duration: 900,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, [avatarScale]);


const [lastError, setLastError] = useState(null);

const logErr = (label, e) => {
  const info = {
    label,
    message: e?.message,
    code: e?.code,
    native: e?.nativeErrorCode,
    details: e?.nativeErrorMessage,
    stack: e?.stack,
  };

  console.log(`❌ ${label}`, info);
  setLastError(info);

  // ✅ never show raw firebase errors to users
  if (__DEV__) {
    Alert.alert(`DEV: ${label}`, `${info.code || ''}\n${info.message || ''}`.trim());
  }
};


const step = async (label, fn) => {
  console.log(`➡️ ${label} | uid=`, auth().currentUser?.uid);
  try {
    const out = await fn();
    console.log(`✅ ${label}`);
    return out;
  } catch (e) {
    logErr(label, e);
    return null;
  }
};


  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [from, setFrom] = useState('');
  const [smoke, setSmoke] = useState('');
  const [drink, setDrink] = useState('');
  const [hobby, setHobby] = useState('');
  const [diet, setDiet] = useState('');
  const [religion, setReligion] = useState('');
  const [languages, setLanguages] = useState('');
  const [education, setEducation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [requiredErrors, setRequiredErrors] = useState({});
  const [extraPhotos, setExtraPhotos] = useState([]); // up to 5
  const [showExtras, setShowExtras] = useState(false); // optional fields toggle
  const [isSaving, setIsSaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  




  /*
  useEffect(() => {
    Geolocation.getCurrentPosition(
  async pos => {
    const { latitude, longitude } = pos.coords;
    console.log('📍User location:', latitude, longitude);
    if (uid) {
      await setDoc(doc(db, 'profiles', uid), { latitude, longitude }, { merge: true });
    }
  },
  error => {
    console.log('❌ Location error:', error);
  },
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
);

  }, [uid]); */
  
  useFocusEffect(
  useCallback(() => {
    const user = auth().currentUser;
    if (!user) return;

    setUid(user.uid);
    setEmail(user.email || '');

    firestore()
      .collection('profiles')
      .doc(user.uid)
      .get()
      .then((snap) => {
        if (!snap.exists) return;
        const d = snap.data();
        setPhoto(d.photo || '');
        setExtraPhotos(d.extraPhotos || []);
        setName(d.name || '');
        setAge(d.age || '');
        setGender(d.gender || '');
        setBio(d.bio || '');
        setFrom(d.from || '');
        setCountry(d.country || '');
        setCity(d.city || '');
        setSmoke(d.smoke || '');
        setDrink(d.drink || '');
        setHobby(d.hobby || '');
        setDiet(d.diet || '');
        setReligion(d.religion || '');
        setLanguages(d.languages || '');
        setEducation(d.education || '');
        setOccupation(d.occupation || '');
        setLookingFor(d.lookingFor || '');
        setInterestedIn(d.interestedIn || '');
        setIsPremium(!!d.isPremium); // <-- make sure you store boolean field: profiles/{uid}.isPremium


      })
      .catch((e) => console.log('loadProfile error', e));
  }, [])
);


 const pickAndUpload = async (currentUid) => {
  return await step('pickAndUpload', async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('perm status:', status);
    if (status !== 'granted') throw new Error('Media permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    console.log('picker canceled?', result.canceled);
    if (result.canceled) return null;

    const uri = result.assets?.[0]?.uri;
    console.log('picked uri:', uri);
    if (!uri) throw new Error('No uri from picker');

    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log('compressed uri:', compressed?.uri);

    const path = `profilePhotos/${currentUid}_${Date.now()}.jpg`;
    console.log('upload path:', path);

    const ref = storage().ref(path);

   const putOk = await step('storage.putFile', async () => {
  await ref.putFile(compressed.uri);
  return true;
});
if (!putOk) throw new Error('Upload failed');

const downloadURL = await step('storage.getDownloadURL', async () => {
  return await ref.getDownloadURL();
});
if (!downloadURL) throw new Error('Upload failed');

return downloadURL;

  });
};


const handlePickImage = async () => {
  try {
    const user = auth().currentUser;
    if (!user) return console.log('Not logged in');

    // permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return console.log('Media library permission denied');

    // pick
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return console.log('Picker canceled');

    const uri = result.assets?.[0]?.uri;
    if (!uri) return console.log('No uri from picker');

    // show immediately (local)
    setPhoto(uri);

    // compress
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );

    // upload (RNFirebase)
    const path = `profilePhotos/${user.uid}_${Date.now()}.jpg`;
    const fileRef = storage().ref(path);

    await fileRef.putFile(compressed.uri);
    const downloadURL = await fileRef.getDownloadURL();

    // replace preview with hosted URL
    setPhoto(downloadURL);

    // save to Firestore (RNFirebase)
    await firestore()
      .collection('profiles')
      .doc(user.uid)
      .set({ uid: user.uid, photo: downloadURL }, { merge: true });


    console.log('Photo uploaded successfully');
  } catch (e) {
    console.log('handlePickImage error', e);
  }
};






const handleAddExtraPhoto = async () => {
  const currentUid = auth().currentUser?.uid || uid;
  if (!currentUid) {
    Alert.alert('Upload failed', 'Please sign in again.');
    return;
  }

  if (extraPhotos.length >= 5) {
    Alert.alert('Limit reached', 'You can add up to 5 photos.');
    return;
  }

  const downloadURL = await pickAndUpload(currentUid);
  if (!downloadURL) {
    Alert.alert('Upload failed', 'Please try again.');
    return;
  }

 try {
  await firestore()
    .collection('profiles')
    .doc(currentUid)
    .set(
      { extraPhotos: firestore.FieldValue.arrayUnion(downloadURL) },
      { merge: true }
    );

  setExtraPhotos((prev) => [...prev, downloadURL]);
} catch (e) {
  logFirebaseErr('save extraPhotos', e);
  Alert.alert('Upload failed', 'Please try again.');
}

};



const handleRemoveExtraPhoto = async (index) => {
  const currentUid = auth().currentUser?.uid;
  if (!currentUid) return console.log('User ID missing');

  const updated = extraPhotos.filter((_, i) => i !== index);
  setExtraPhotos(updated);

await firestore()
  .collection('profiles')
  .doc(currentUid)
  .set(
    {
      uid: currentUid,
      extraPhotos: updated,
    },
    { merge: true }
  );

};


const handleSave = async () => {
  if (isSaving) return;
  setIsSaving(true);

  try {
    const user = auth().currentUser;
    if (!user) {
      setIsSaving(false);
      return console.log('Error', 'Not logged in');
    }

    const uid = user.uid;
    setUid(uid);
    setEmail(user.email || email);

    const numericAge = Number(age);
if (age && !Number.isNaN(numericAge) && numericAge < 18) {
  setIsSaving(false);
  setRequiredErrors((prev) => ({ ...prev, age: true }));
  setSaveWarning('You have to be above 18 to use this app');

  firestore()
    .collection('profiles')
    .doc(uid)
    .set(
      { age, isComplete: false, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    )
    .catch(() => {});

  return;
}



    const hasAtLeastTwoPhotos = !!photo && extraPhotos.length >= 1;

    const errors = {
  photo: !photo,
  photos: !hasAtLeastTwoPhotos,
  name: !name,
  age: !age,
  gender: !gender,
  from: !from,
  country: !country, // ✅ Current Country required
  city: !city,
  bio: !bio,
  lookingFor: !lookingFor,
  interestedIn: !interestedIn,

};


    setRequiredErrors(errors);

    const missing = Object.keys(errors).filter((key) => errors[key]);
    const isComplete = missing.length === 0;

    const profileData = {
      uid,
      email: user.email || email,
      photo,
      extraPhotos,
name: String(name || "").trim(),
      age,
      gender,
      bio,
      from,
      country,
      city,
      smoke,
      drink,
      hobby,
      diet,
      religion,
      languages,
      education,
      occupation,
      lookingFor,
      interestedIn,
      isComplete,
      updatedAt: new Date(),
nameLower: String(name || "").trim().toLowerCase(),

    };

    // ✅ FAST SAVE (don’t wait)
    const saveRef = firestore().collection('profiles').doc(uid);

    const savePromise = saveRef.set(
      { ...profileData, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    // ✅ LOCATION UPDATE (don’t block)
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) =>
        status === 'granted' ? Location.getCurrentPositionAsync({}) : null
      )
      .then((pos) => {
        if (!pos) return;
        return saveRef.set(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { merge: true }
        );
      })
      .catch(() => {});

    // ✅ UI INSTANT
setIsSaving(false);

if (!isComplete) {
  setSaveWarning('Please finish the required fields');
} else {
  setSaveWarning('');
  Alert.alert('Saved', 'Saved ✅');
}

    // if the write fails, show it
    savePromise.catch((e) => {
      logFirebaseErr(`save profiles/${uid}`, e);
      Alert.alert('Save failed', 'Check internet and try again.');
    });

    if (!isComplete) {
      console.log(
        '⚠️ Incomplete Profile',
        `Please complete these before being visible in matches:\n\n• ${missing
          .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
          .join('\n• ')}`
      );
      return;
    }

    const justSignedUp = await AsyncStorage.getItem('justSignedUp');
    if (justSignedUp === 'true') {
      await AsyncStorage.removeItem('justSignedUp');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } else {
      console.log('✅ Profile saved successfully!');
    }
  } finally {
    setIsSaving(false);
  }
};



  const RequiredLabel = ({ visible }) =>
    visible ? <Text style={{ color: 'red', fontSize: 12 }}>Required *</Text> : null;

 const allCountries = countriesWithCities
  .map(c => c.country)
  .sort();

const getCities = (countryName) => {
  if (!countryName) return [];
  const item = countriesWithCities.find(c => c.country === countryName);
  return item ? item.cities : [];
};

const languageList = [
  'Afrikaans','Amharic','Arabic','Bengali','Chinese (Mandarin)','Croatian','Czech','Danish','Dutch',
  'English','Filipino','Finnish','French','German','Greek','Gujarati','Hausa','Hebrew','Hindi',
  'Hungarian','Igbo','Indonesian','Italian','Japanese','Korean','Malay','Nepali','Ndebele','Norwegian',
  'Oromo','Other','Persian (Farsi)','Polish','Portuguese','Punjabi','Romanian','Russian','Serbian',
  'Shona','Slovak','Somali','Spanish','Swahili','Swedish','Tamil','Thai','Tigrinya','Turkish',
  'Ukrainian','Urdu','Vietnamese','Yoruba','Zulu'
];

const options = (list) => list.map((v) => ({ label: v, value: v }));


return (
  <KeyboardAvoidingView
    style={styles.screen}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={100}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <LinearGradient
            colors={['#ffffff', '#f3e9ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            {/* <Text style={styles.headerTitle}>My Profile ✨</Text> */}
            <Text style={styles.headerSubtitle}>
              Complete your details to shine in matches 🫶
            </Text>
          </LinearGradient>

          <Animated.View
  style={[
    isPremium ? styles.photoWrapperPremium : styles.photoWrapper,
    { transform: [{ scale: avatarScale }] },
  ]}
>

            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderEmoji}>📸</Text>
                <Text style={styles.placeholderText}>Add a nice photo</Text>
              </View>
            )}
          </Animated.View>

          <RequiredLabel visible={requiredErrors.photo} />

         <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
  <Text style={styles.photoButtonText}>
    {photo ? 'Change Photo' : 'Add profile photo'}
  </Text>
</TouchableOpacity>



<View style={styles.extraSection}>
  <View style={styles.extraHeaderRow}>
    <Text style={styles.label}>More Photos</Text>
    <Text style={styles.extraHint}>Add at least 1 extra • up to 5</Text>
  </View>
  <RequiredLabel visible={requiredErrors.photos} />


  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.extraPhotosRow}
  >
    {extraPhotos.map((uri, index) => (
      <TouchableOpacity
        key={index}
        onLongPress={() => handleRemoveExtraPhoto(index)}
        style={styles.extraPhotoWrapper}
      >
        <Image source={{ uri }} style={styles.extraPhoto} />
      </TouchableOpacity>
    ))}

    {extraPhotos.length < 5 && (
      <TouchableOpacity
        style={styles.addExtraCard}
        onPress={handleAddExtraPhoto}
      >
        <Text style={styles.addExtraIcon}>＋</Text>
        <Text style={styles.addExtraText}>Add more</Text>
      </TouchableOpacity>
    )}
  </ScrollView>
</View>


          <Text style={styles.label}>Email: {email}</Text>

          <Text style={styles.label}>Name</Text>
          <RequiredLabel visible={requiredErrors.name} />
          <TextInputBox value={name} setter={setName} />

          <Text style={styles.label}>Age</Text>
          <RequiredLabel visible={requiredErrors.age} />
          <TextInputBox value={age} setter={setAge} keyboardType="numeric" />

          <Text style={styles.label}>Gender</Text>
          <RequiredLabel visible={requiredErrors.gender} />
          <RNPickerSelect onValueChange={setGender} items={options(['Male','Female'])} value={gender} style={pickerStyle} />
          <Text style={styles.label}>Interested In</Text>
             <RequiredLabel visible={requiredErrors.interestedIn} />
             <RNPickerSelect
              onValueChange={setInterestedIn}
            items={options(['Men','Women'])}
            value={interestedIn}
            style={pickerStyle}
            />


          <Text style={styles.label}>About Me</Text>
          <RequiredLabel visible={requiredErrors.bio} />
          <TextInput
            value={bio}
            onChangeText={setBio}
            style={styles.bioBox}
            placeholder="Short and sweet, 1–2 lines..."
            multiline
            maxLength={160}
          />

{__DEV__ && lastError && (
  <View style={{ marginTop: 10, padding: 10, borderWidth: 1 }}>
    <Text>DEBUG: {lastError.label}</Text>
    <Text>{lastError.code}</Text>
    <Text numberOfLines={3}>{lastError.message}</Text>
  </View>
)}


<Text style={styles.label}>Country of Origin</Text>
<RequiredLabel visible={requiredErrors.from} />
<SearchableSelect
  value={from}
  onChange={(v) => setFrom(v || '')}
  items={allCountries}
  placeholder="Search country of origin..."
/>


<Text style={styles.label}>Current Country</Text>
<RequiredLabel visible={requiredErrors.country} />
<SearchableSelect
  value={country}
  onChange={(v) => {
    setCountry(v || '');
    setCity(''); // keep your reset logic ✅
  }}
  items={allCountries}
  placeholder="Search current country..."
/>




<Text style={styles.label}>Current City</Text>
<RequiredLabel visible={requiredErrors.city} />
<SearchableSelect
  value={city}
  onChange={(v) => setCity(v || '')}
  items={getCities(country)}
  placeholder="Search current city..."
/>


                  {/* Looking For (required) */}
          <Text style={styles.label}>Looking For</Text>
          <RequiredLabel visible={requiredErrors.lookingFor} />
          <RNPickerSelect
            onValueChange={setLookingFor}
            items={options(['Friendship','Serious Relationship','Marriage','Casual Dating','Networking','Other'])}
            value={lookingFor}
            style={pickerStyle}
          />

          {/* Toggle for optional fields */}
          <TouchableOpacity
            style={styles.extrasToggle}
            onPress={() => setShowExtras(prev => !prev)}
          >
            <Text style={styles.extrasToggleText}>
              {showExtras ? 'Hide optional details' : 'More about me (optional)'}
            </Text>
          </TouchableOpacity>

          {showExtras && (
            <>
              <Text style={styles.label}>Do you smoke?</Text>
              <RNPickerSelect
                onValueChange={setSmoke}
                items={options(['No','Occasionally','Socially','Often','Trying to quit','Other'])}
                value={smoke}
                style={pickerStyle}
              />

              <Text style={styles.label}>Do you drink?</Text>
              <RNPickerSelect
                onValueChange={setDrink}
                items={options(['No','Occasionally','Socially','Often','Other'])}
                value={drink}
                style={pickerStyle}
              />

              <Text style={styles.label}>Hobby</Text>
              <RNPickerSelect
                onValueChange={setHobby}
                items={options([
                  'Travel','Reading','Music','Art','Cooking','Movies','Sports','Hiking',
                  'Photography','Fashion','Gaming','Gardening','Fitness','Writing',
                  'Volunteering','Dancing','Meditation','Pets','Other'
                ])}
                value={hobby}
                style={pickerStyle}
              />

              <Text style={styles.label}>Diet</Text>
              <RNPickerSelect
                onValueChange={setDiet}
                items={options(['Regular','Vegetarian','Vegan','Halal','Kosher','Pescatarian','Gluten-free','Other'])}
                value={diet}
                style={pickerStyle}
              />

              <Text style={styles.label}>Religion</Text>
              <RNPickerSelect
                onValueChange={setReligion}
                items={options([
                  'Christian','Muslim','Orthodox','Catholic','Protestant','Jewish',
                  'Hindu','Buddhist','Spiritual','Agnostic','Atheist','Other'
                ])}
                value={religion}
                style={pickerStyle}
              />

              <Text style={styles.label}>Languages Spoken</Text>
              <RNPickerSelect
                onValueChange={setLanguages}
                items={options(languageList)}
                value={languages}
                style={pickerStyle}
              />

              <Text style={styles.label}>Education</Text>
              <RNPickerSelect
                onValueChange={setEducation}
                items={options([
                  'High School','Diploma','Bachelor’s','Master’s','PhD',
                  'Technical','Currently Studying','Other'
                ])}
                value={education}
                style={pickerStyle}
              />

              <Text style={styles.label}>Occupation</Text>
              <RNPickerSelect
                onValueChange={setOccupation}
                items={options([
                  'Technology','Healthcare','Education','Finance','Engineering','Law',
                  'Arts','Entertainment','Hospitality','Retail','Construction',
                  'Transportation','Government','Marketing','Science','Agriculture',
                  'Student','Unemployed','Other'
                ])}
                value={occupation}
                style={pickerStyle}
              />
            </>
          )}
              {saveWarning ? <Text style={styles.saveWarning}>{saveWarning}</Text> : null}

          <TouchableOpacity
  style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
  onPress={handleSave}
  disabled={isSaving}
>
  <Text style={{ color: 'white', fontWeight: 'bold' }}>
    {isSaving ? 'Saving...' : 'Save Profile'}
  </Text>
</TouchableOpacity>

        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
);
}

const TextInputBox = ({ value, setter, ...props }) => (
  <View style={styles.inputBox}>
    <TextInput {...props} value={value} onChangeText={setter} style={{ flex: 1 }} />
  </View>
);


const SearchableSelect = ({
  value,
  onChange,
  items,
  placeholder = 'Select...',
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const list = (items || []).filter((x) =>
    String(x).toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => {
          setQ('');
          setOpen(true);
        }}
      >
        <Text style={styles.selectText}>{value || placeholder}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search..."
                  style={styles.searchInput}
                  autoFocus
                />

                <FlatList
                  keyboardShouldPersistTaps="handled"
                  data={list}
                  keyExtractor={(item, idx) => `${item}-${idx}`}
                  ItemSeparatorComponent={() => <View style={styles.optionDivider} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};


const styles = StyleSheet.create({
 // ✅ NEW
screen: {
  flex: 1,
  backgroundColor: '#f3f0ff',
},

container: {
  padding: 20,
  paddingBottom: 40,
  flexGrow: 1,
  justifyContent: 'flex-start',
},
// (you don’t need title anymore)

photoWrapperPremium: {
  alignSelf: 'center',
  padding: 6,
  borderRadius: 999,
  backgroundColor: '#fff7d1',
  borderWidth: 2,
  borderColor: '#D4AF37',
  shadowColor: '#D4AF37',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 18,
  elevation: 8,
  marginBottom: 10,
},

card: {
  backgroundColor: '#ffffff',
  borderRadius: 24,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 10,
},

headerGradient: {
  borderRadius: 20,
  paddingVertical: 16,
  paddingHorizontal: 18,
  marginBottom: 16,
},

headerSubtitle: {
  marginTop: 4,
  fontSize: 13,
  color: '#7a6c9b',
},

  extrasToggle: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(103,58,183,0.35)',
    backgroundColor: 'rgba(243,240,255,0.9)',
  },

  extrasToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b3b8f',
  },

photoWrapper: {
  alignSelf: 'center',
  padding: 6,
  borderRadius: 999,
  backgroundColor: '#f5ecff',
  shadowColor: '#673ab7',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 16,
  elevation: 6,
  marginBottom: 10,
},

placeholderEmoji: {
  fontSize: 30,
  marginBottom: 4,
},

placeholderText: {
  fontSize: 12,
  color: '#777',
},

photoButton: {
  marginTop: 12,
  marginBottom: 12,
  alignSelf: 'center',
  width: '80%',          // ⬅️ make it wide
  paddingVertical: 14,
  borderRadius: 999,
  backgroundColor: '#673ab7',
  shadowColor: '#673ab7',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 10,         // Android glow
},

photoButtonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 16,
  textAlign: 'center',
  letterSpacing: 0.5,
},

photo: {
  width: 150,
  height: 150,
  borderRadius: 75,
  alignSelf: 'center',
  marginBottom: 15,
  resizeMode: 'cover',
},

extraSection: {
  marginTop: 4,
  marginBottom: 18,
},

extraHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

extraHint: {
  fontSize: 11,
  color: '#9a8fbf',
},

extraPhotosRow: {
  paddingVertical: 10,
},

extraPhotoWrapper: {
  marginRight: 10,
  borderRadius: 18,
  overflow: 'hidden',
  backgroundColor: '#f5ecff',
},

extraPhoto: {
  width: 72,
  height: 96,
  borderRadius: 18,
},

addExtraCard: {
  width: 72,
  height: 96,
  borderRadius: 18,
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: 'rgba(103,58,183,0.45)',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(243,240,255,0.9)',
},

addExtraIcon: {
  fontSize: 24,
  color: '#673ab7',
  marginBottom: 4,
},

addExtraText: {
  fontSize: 12,
  color: '#673ab7',
  fontWeight: '600',
},

  placeholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 15,
  },
  label: { 
  marginTop: 12,
  fontWeight: '600',
  color: '#3b3550',
  fontSize: 14,
},

inputBox: {
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.25)',
  borderRadius: 14,
  padding: 10,
  marginTop: 6,
  marginBottom: 10,
  backgroundColor: 'rgba(255,255,255,0.95)',
},

bioBox: {
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.25)',
  borderRadius: 14,
  padding: 10,
  minHeight: 90,
  textAlignVertical: 'top',
  marginTop: 6,
  marginBottom: 10,
  backgroundColor: 'rgba(255,255,255,0.95)',
},

saveButton: {
  backgroundColor: '#673ab7',
  paddingVertical: 14,
  borderRadius: 999,
  alignItems: 'center',
  marginVertical: 28,
  shadowColor: '#673ab7',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
  elevation: 8,
},
saveWarning: {
  color: 'red',
  textAlign: 'center',
  marginTop: 10,
  fontWeight: '600',
},

selectButton: {
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.25)',
  borderRadius: 14,
  padding: 12,
  marginTop: 6,
  marginBottom: 10,
  backgroundColor: 'rgba(255,255,255,0.95)',
},

selectText: {
  color: '#000',
},

modalBackdrop: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.35)',
  justifyContent: 'center',
  padding: 18,
},

modalCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 14,
  maxHeight: '75%',
},

searchInput: {
  borderWidth: 1,
  borderColor: 'rgba(103,58,183,0.25)',
  borderRadius: 12,
  padding: 10,
  marginBottom: 10,
},

optionRow: {
  paddingVertical: 12,
  paddingHorizontal: 8,
},

optionText: {
  color: '#000',
  fontSize: 14,
},

optionDivider: {
  height: 1,
  backgroundColor: 'rgba(0,0,0,0.06)',
},

closeBtn: {
  marginTop: 10,
  paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: '#673ab7',
  alignItems: 'center',
},

closeBtnText: {
  color: '#fff',
  fontWeight: '700',
},

});