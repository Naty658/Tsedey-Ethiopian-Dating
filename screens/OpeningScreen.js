import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function OpeningScreen({ navigation }) {
  const glowAnim = useRef(new Animated.Value(1)).current;     // button pulse
  const textGlow = useRef(new Animated.Value(0)).current;     // glowing text aura

  useEffect(() => {
    // 🔘 Button Glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 💫 Text Aura Glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(textGlow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(textGlow, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim, textGlow]);

  const glowShadow = textGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  // NEW return – drop the logo + basic layout
return (
  <View style={styles.container}>
    {/* cinematic gradient background */}
    <LinearGradient
      colors={['#050816', '#140b2a', '#2b061b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />

    {/* abstract “broken / fire / smoke” shards */}
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

    {/* cinematic couple photo */}
    <Animated.Image
      source={require('../assets/images/opening.png')}
      style={styles.heroImage}
    />

    {/* glass card + CTA */}
    <View style={styles.glassCard}>
      <Animated.Text
        style={[
          styles.title,
          {
            textShadowColor: '#ff3b6a',
            textShadowRadius: glowShadow,
            textShadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        Lavish Dating
      </Animated.Text>

      <Text style={styles.subtitle}>
        Step into a cinematic world of real connections.
      </Text>

      <Animated.View style={{ transform: [{ scale: glowAnim }] }}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <LinearGradient
            colors={['#ff3366', '#ff7b3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.footnote}>No small talk. Just real vibes.</Text>
    </View>
  </View>
);

}

const styles = StyleSheet.create({
 // NEW – replace your old container
container: {
  flex: 1,
  backgroundColor: '#050816',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingBottom: 60,
},

// NEW – cinematic hero image (instead of topImage)
heroImage: {
  position: 'absolute',
  top: 0,
  width: '115%',
  height: '68%',
  resizeMode: 'cover',
  opacity: 0.9,
},

// NEW – glass card on bottom
glassCard: {
  width: '88%',
  paddingHorizontal: 22,
  paddingVertical: 20,
  borderRadius: 28,
  backgroundColor: 'rgba(10, 10, 22, 0.9)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: 0.45,
  shadowRadius: 30,
  elevation: 18,
},


 
// NEW – replace your old title style
title: {
  fontSize: 28,
  fontWeight: '800',
  color: '#fff',
  letterSpacing: 1.1,
},

subtitle: {
  marginTop: 6,
  fontSize: 14,
  color: 'rgba(255,255,255,0.78)',
},

footnote: {
  marginTop: 10,
  fontSize: 12,
  color: 'rgba(255,255,255,0.6)',
},

// NEW abstract shards (broken / fire / smoke vibe)
shardTopLeft: {
  position: 'absolute',
  top: -80,
  left: -60,
  width: 260,
  height: 260,
  borderRadius: 40,
  opacity: 0.85,
  transform: [{ rotate: '-18deg' }],
},

shardBottomRight: {
  position: 'absolute',
  bottom: -100,
  right: -40,
  width: 260,
  height: 260,
  borderRadius: 40,
  opacity: 0.75,
  transform: [{ rotate: '22deg' }],
},



 // NEW – replace your old button + keep same name
button: {
  marginTop: 22,
  paddingVertical: 14,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#ff3b6a',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 16,
  elevation: 12,
},



  
// slight tweak (optional)
buttonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 18,
  textAlign: 'center',
},
});
