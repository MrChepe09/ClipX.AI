import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';

export function BrandSplash({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]);

    intro.start();
  }, [glow, scale]);

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [opacity, visible]);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glow.interpolate({
              inputRange: [0.4, 1],
              outputRange: [0.25, 0.6],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.85, 1.08],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI Clipart Studio</Text>
        </View>
        <Text style={styles.title}>ClipX.AI</Text>
        <Text style={styles.subtitle}>Turn portraits into bold, beautiful clipart</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#4F46E5',
    shadowColor: '#818CF8',
    shadowOpacity: 0.45,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.28)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  badgeText: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(129, 140, 248, 0.35)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 6 },
  },
  subtitle: {
    marginTop: 12,
    color: '#A5B4FC',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 21,
  },
});
