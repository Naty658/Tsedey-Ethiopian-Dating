import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '../translations';

export default function LanguageSelectionScreen({ navigation }) {
  const handleSelect = (lang) => {
    // setAppLanguage(lang); // plug in your translation logic here
    navigation.replace('Opening'); // or 'Opening' based on your navigator
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#050816', '#140b2a', '#2b061b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shardTopLeft}
      />
      <LinearGradient
        colors={['rgba(255,71,87,0.5)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.shardBottomRight}
      />

      <View style={styles.glassCard}>
        <Text style={styles.heading}>Choose your language</Text>
        <Text style={styles.subheading}>Select how you want to experience Eyorika.</Text>

        <View style={styles.languageRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleSelect('en')}
            style={styles.languageWrapper}
          >
            <LinearGradient
              colors={['#ff3366', '#ff7b3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.languageCardPrimary}
            >
              <Text style={styles.languageCode}>EN</Text>
              <Text style={styles.languageName}>English</Text>
              <Text style={styles.languageHint}>Recommended</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleSelect('am')}
            style={styles.languageWrapper}
          >
            <View style={styles.languageCardSecondary}>
              <Text style={styles.languageCode}>አማ</Text>
              <Text style={styles.languageName}>Amharic</Text>
              <Text style={styles.languageHint}>አማርኛ</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>You can change this later in Settings.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  glassCard: {
    width: '100%',
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 10, 22, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },

  subheading: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  languageRow: {
  marginTop: 18,
  flexDirection: 'row',
  // gap: 12,   ❌ remove this
  justifyContent: 'space-between',  // ✅ add this
},
languageWrapper: {
  flex: 0.48,   // instead of flex: 1
},


  languageCardPrimary: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
    shadowColor: '#ff3b6a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 16,
  },

  languageCardSecondary: {
  flex: 1,
  borderRadius: 24,
  paddingVertical: 16,
  paddingHorizontal: 14,
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.95)', // ⬅️ make it light
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.08)',
},



  languageCode: {
  fontSize: 18,
  fontWeight: '800',
  color: '#fff',   // ← change back to white
},

languageName: {
  marginTop: 4,
  fontSize: 15,
  fontWeight: '600',
  color: '#fff',   // ← change back to white
},

languageHint: {
  marginTop: 2,
  fontSize: 11,
  color: 'rgba(255,255,255,0.8)',  // ← light text
},

  footerNote: {
    marginTop: 16,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  shardTopLeft: {
    position: 'absolute',
    top: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 40,
    opacity: 0.9,
    transform: [{ rotate: '-18deg' }],
  },

  shardBottomRight: {
    position: 'absolute',
    bottom: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 40,
    opacity: 0.75,
    transform: [{ rotate: '22deg' }],
  },
});
