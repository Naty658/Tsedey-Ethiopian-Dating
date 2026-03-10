import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { navigationRef } from './src/navigationRef';
import { getActiveScreen } from './src/navigationRef';
import { logFirebaseErr } from './src/fbDebug';


import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OpeningScreen from './screens/OpeningScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MainScreen from './screens/MainScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';
import SettingsScreen from './screens/SettingsScreen';
import MatchScreen from './screens/MatchScreen';
import ConnectionsScreen from './screens/ConnectionsScreen';
import ProfileViewScreen from './screens/ProfileViewScreen';
import ChatListScreen from './screens/ChatListScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import PhoneLinkScreen from './screens/PhoneLinkScreen';
import ChatRequestsScreen from './screens/ChatRequestsScreen';


//import Geolocation from '@react-native-community/geolocation';
//import { PermissionsAndroid, Platform, Alert } from 'react-native';

//import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { useEffect } from 'react';

import { Alert, AppState, Linking, Platform, InteractionManager, View, Text } from 'react-native';

import remoteConfig from '@react-native-firebase/remote-config';
import * as Application from 'expo-application';

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VerifyCodeScreen from './screens/VerifyCodeScreen';
import CreatePasswordScreen from './screens/CreatePasswordScreen';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/*
if (__DEV__) {
  auth().settings.appVerificationDisabledForTesting = true;
}
*/


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});



export type RootStackParamList = {
  Opening: undefined;
  Login: undefined;
  Signup: undefined;
    PhoneLink: undefined;

  Main: undefined;
  Match: undefined;
  Profile: undefined;
  Chat: undefined;
  Settings: undefined;
  Connections: undefined;
  ProfileView: undefined;
  ChatList: undefined;
  ChatRequests: undefined;
  ForgotPassword: undefined;
  VerifyCode: { phone: string; verificationId: string };
  CreatePassword: { phone: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();



const ANDROID_STORE_URL = 'market://details?id=com.tsedey';
const ANDROID_WEB_URL   = 'https://play.google.com/store/apps/details?id=com.tsedey';
const IOS_STORE_URL     = 'itms-apps://apps.apple.com/app/idYOUR_APP_ID';

type ForceUpdateResult = { blocked: boolean; message: string };

async function checkForceUpdate(): Promise<ForceUpdateResult> {
  await remoteConfig().setDefaults({
    android_min_build: 24,
    force_update_message: 'Please update the app to continue.',
  });

  await remoteConfig().setConfigSettings({
  minimumFetchIntervalMillis: 0, // always fetch for force-update
});

  let minBuild = remoteConfig().getNumber('android_min_build');

  try {
    // timeout so release can’t “hang” startup on bad networks
    await Promise.race([
      remoteConfig().fetchAndActivate(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RC timeout')), 8000)),
    ]);
    minBuild = remoteConfig().getNumber('android_min_build');
  } catch {
    // keep cached/default minBuild
  }

  const currentBuild = parseInt(String(Application.nativeBuildVersion ?? '0'), 10) || 0;

  if (currentBuild >= minBuild) return { blocked: false, message: '' };

  const msg =
    remoteConfig().getString('force_update_message') ||
    'Please update the app to continue.';

  return { blocked: true, message: msg };
}

function ForceUpdateScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Update required</Text>
    </View>
  );
}


export default function App() {

const [blocked, setBlocked] = React.useState(false);
const [checking, setChecking] = React.useState(true);


const forceMsgRef = React.useRef<string>('');
const alertShownRef = React.useRef(false);

useEffect(() => {
  (async () => {
    try {
      const res = await checkForceUpdate();
      forceMsgRef.current = res.message;
      setBlocked(res.blocked);
    } catch {
      setBlocked(false);
    } finally {
      setChecking(false);
    }
  })();
}, []);

useEffect(() => {
  if (checking || !blocked || alertShownRef.current) return;

  alertShownRef.current = true;

  InteractionManager.runAfterInteractions(() => {
    Alert.alert(
      'Update required',
      forceMsgRef.current || 'Please update the app to continue.',
      [
        {
          text: 'Update',
          onPress: async () => {
            if (Platform.OS === 'android') {
              const can = await Linking.canOpenURL(ANDROID_STORE_URL);
              await Linking.openURL(can ? ANDROID_STORE_URL : ANDROID_WEB_URL);
            } else {
              await Linking.openURL(IOS_STORE_URL);
            }
          },
        },
      ],
      { cancelable: false }
    );
  });
}, [checking, blocked]);


 useEffect(() => {
  const unsub = auth().onAuthStateChanged((user) => {
    if (!user || blocked || checking) return;
    


    (async () => {
      try {
        console.log('🔔 register() start for uid=', user.uid);

        if (!Device.isDevice) return;

        // Android channel (required for reliable delivery/importance)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'fafd4c55-11c3-4a52-93b0-3ba5b4735547',
        });

        const expoToken = tokenData.data;
        console.log('🔔 expoToken =', expoToken);

        await firestore()
          .collection('users')
          .doc(user.uid)
          .set({ expoPushToken: expoToken }, { merge: true });

        console.log('✅ Saved expoPushToken to Firestore');
      } catch (err) {
        console.log('🔥 Error in register():', err);
      }
    })();
  });

   return () => unsub();
}, [blocked, checking]);


    useEffect(() => {
    const updatePresence = async (state: string) => {
      try {
        const uid = await AsyncStorage.getItem('uid');
        if (!uid) return;

        const online = state === 'active';

        const user = auth().currentUser;
if (!user) return;

await firestore()
  .collection('presence')
  .doc(user.uid)
  .set(
    { online, lastSeen: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

      } catch (e) {
        console.log(`🔥 presence error @${getActiveScreen()}:`, e);
        logFirebaseErr('presence write (AppState)', e);
      }
    };

    // initial: app opened = online
    updatePresence('active');

    const sub = AppState.addEventListener('change', updatePresence);
    return () => sub.remove();
  }, []);


  if (checking) return null;
if (blocked) return <ForceUpdateScreen />;


  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Opening">
        <Stack.Screen
          name="Opening"
          component={OpeningScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="PhoneLink" component={PhoneLinkScreen} />

        <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
        <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen
          name="Main"
          component={MainScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="ChatRequests" component={ChatRequestsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Match" component={MatchScreen} />
        <Stack.Screen name="Connections" component={ConnectionsScreen} />
        <Stack.Screen name="ProfileView" component={ProfileViewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
