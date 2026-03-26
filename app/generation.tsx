import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Compare, { After, Before, DefaultDragger } from 'react-native-before-after-slider-v2';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StyleKey, generateClipart } from '@/src/services/clipartService';

const STYLES: StyleKey[] = ['cartoon', 'flat', 'anime', 'pixel', 'sketch'];
const COMPARE_WIDTH = Dimensions.get('window').width - 64;
const COMPARE_HEIGHT = 240;

const STYLE_LABELS: Record<StyleKey, string> = {
  cartoon: '🎨 Cartoon',
  flat: '📐 Flat',
  anime: '⛩️ Anime',
  pixel: '👾 Pixel',
  sketch: '✏️ Sketch',
};

const FALLBACK_BEFORE_IMAGE = require('@/assets/images/partial-react-logo.png');

interface StyleState {
  status: 'loading' | 'success' | 'failed';
  url?: string;
  error?: string;
  note?: string;
}

// Animated skeleton component
function SkeletonBox({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: '#2D2D3A', borderRadius: 12 }, style, { opacity }]} />;
}

export default function GenerationScreen() {
  const { imageBase64, styles: selectedStylesParam } = useLocalSearchParams<{ imageBase64: string; styles?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cardAnimMap = useRef<Record<string, Animated.Value>>({}).current;

  const requestedStyles = useMemo<StyleKey[]>(() => {
    if (!selectedStylesParam) return STYLES;
    const raw = Array.isArray(selectedStylesParam) ? selectedStylesParam.join(',') : selectedStylesParam;
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is StyleKey => STYLES.includes(s as StyleKey));
    return parsed.length > 0 ? parsed : STYLES;
  }, [selectedStylesParam]);

  const [results, setResults] = useState<Record<StyleKey, StyleState>>(
    () => Object.fromEntries(STYLES.map(s => [s, { status: 'loading' }])) as Record<StyleKey, StyleState>
  );
  const [hasError, setHasError] = useState(false);
  const [busyStyle, setBusyStyle] = useState<StyleKey | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [generatingStyle, setGeneratingStyle] = useState<StyleKey | null>(null);

  const originalImageUri = useMemo(() => {
    if (!imageBase64) return undefined;
    return imageBase64.startsWith('data:image') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  }, [imageBase64]);

  const downloadImage = async (style: StyleKey, imageUrl: string) => {
    try {
      setBusyStyle(style);
      const extension = imageUrl.includes('.png') ? 'png' : 'jpg';
      const fileUri = `${FileSystem.documentDirectory}${style}-${Date.now()}.${extension}`;
      await FileSystem.downloadAsync(imageUrl, fileUri);
      Alert.alert('Downloaded', `Saved file for ${STYLE_LABELS[style]}`);
    } catch (error) {
      Alert.alert('Download failed', 'Unable to save image on this device.');
    } finally {
      setBusyStyle(null);
    }
  };

  const shareImage = async (style: StyleKey, imageUrl: string) => {
    try {
      setBusyStyle(style);
      const extension = imageUrl.includes('.png') ? 'png' : 'jpg';
      const fileUri = `${FileSystem.cacheDirectory}${style}-${Date.now()}.${extension}`;
      await FileSystem.downloadAsync(imageUrl, fileUri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: `Share ${STYLE_LABELS[style]}`,
          mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
        });
      } else {
        await Linking.openURL(imageUrl);
      }
    } catch (error) {
      Alert.alert('Share failed', 'Unable to share this image right now.');
    } finally {
      setBusyStyle(null);
    }
  };

  const generateSingleStyle = async (style: StyleKey) => {
    if (!imageBase64) return;

    setGeneratingStyle(style);
    setResults((prev) => ({ ...prev, [style]: { status: 'loading' } }));

    try {
      const response = await generateClipart(imageBase64, [style]);
      const r = response.results[style];

      setResults((prev) => ({
        ...prev,
        [style]: {
          status: r?.status === 'success' ? 'success' : 'failed',
          url: r?.url,
          error: r?.error,
          note: r?.note,
        },
      }));
    } catch (err) {
      setHasError(true);
      setResults((prev) => ({
        ...prev,
        [style]: { status: 'failed', error: 'Generation failed' },
      }));
    } finally {
      setGeneratingStyle(null);
    }
  };

  const runGeneration = async () => {
    if (!imageBase64) return;

    setHasError(false);
    progressAnim.setValue(0);

    requestedStyles.forEach((style) => {
      if (!cardAnimMap[style]) {
        cardAnimMap[style] = new Animated.Value(0.88);
      } else {
        cardAnimMap[style].setValue(0.88);
      }
    });

    setResults(
      Object.fromEntries(requestedStyles.map((s) => [s, { status: 'loading' }])) as Record<StyleKey, StyleState>
    );

    for (const style of requestedStyles) {
      await generateSingleStyle(style);
    }
  };

  useEffect(() => {
    runGeneration();
  }, [selectedStylesParam]);

  const successCount = requestedStyles.filter(s => results[s]?.status === 'success').length;
  const loadingCount = requestedStyles.filter(s => results[s]?.status === 'loading').length;
  const failedCount = requestedStyles.filter(s => results[s]?.status === 'failed').length;
  const completedCount = successCount + failedCount;
  const progress = requestedStyles.length > 0 ? completedCount / requestedStyles.length : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    requestedStyles.forEach((style, index) => {
      if (!cardAnimMap[style]) {
        cardAnimMap[style] = new Animated.Value(0.88);
      }

      if (results[style]?.status !== 'loading') {
        Animated.timing(cardAnimMap[style], {
          toValue: 1,
          duration: 250,
          delay: index * 70,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [requestedStyles, results, cardAnimMap]);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#9CA3AF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Generating Styles</Text>
          {loadingCount > 0 ? (
            <Text style={styles.headerSub}>{loadingCount} remaining...</Text>
          ) : (
            <Text style={styles.headerSub}>{successCount} of {requestedStyles.length} done</Text>
          )}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.retryBtn}>
          <Ionicons name="hourglass-outline" size={20} color="#6B7280" />
        </View>
      </View>

      {/* Error banner */}
      {hasError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
          <Text style={styles.errorBannerText}>Something went wrong. Tap ↻ to retry.</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
        {requestedStyles.map(style => {
          const result = results[style];
          const cardAnim = cardAnimMap[style] || new Animated.Value(1);
          const isDemoResult = !!result?.note?.includes('DEMO_MODE');
          const baseImageUri = isDemoResult
            ? (originalImageUri || result.url)
            : result.url;
          const overlayImageUri = isDemoResult
            ? result.url
            : originalImageUri;
          const shouldUseFallbackBefore = !overlayImageUri || overlayImageUri === baseImageUri;
          return (
            <Animated.View
              key={style}
              style={[
                styles.card,
                {
                  opacity: cardAnim,
                  transform: [
                    {
                      scale: cardAnim,
                    },
                  ],
                },
              ]}>
              {/* Card header */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>{STYLE_LABELS[style]}</Text>
                {result.status === 'loading' && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Generating...</Text>
                  </View>
                )}
                {result.status === 'success' && (
                  <View style={[styles.statusBadge, styles.statusSuccess]}>
                    <Text style={[styles.statusText, { color: '#6EE7B7' }]}>Done ✓</Text>
                  </View>
                )}
                {result.status === 'failed' && (
                  <View style={[styles.statusBadge, styles.statusFailed]}>
                    <Text style={[styles.statusText, { color: '#FCA5A5' }]}>Failed</Text>
                  </View>
                )}
              </View>

              {/* Card body */}
              {result.status === 'loading' && (
                <SkeletonBox style={styles.cardImage} />
              )}
              {result.status === 'success' && result.url && (
                <>
                  {baseImageUri ? (
                    <View style={styles.compareContainer}>
                      <Compare
                        width={COMPARE_WIDTH}
                        height={COMPARE_HEIGHT}
                        initial={0}
                        draggerWidth={44}
                        onMoveStart={() => setScrollEnabled(false)}
                        onMoveEnd={() => setScrollEnabled(true)}>
                        <Before>
                          <Image
                            source={shouldUseFallbackBefore ? FALLBACK_BEFORE_IMAGE : { uri: overlayImageUri }}
                            style={styles.compareImage}
                            resizeMode="contain"
                          />
                        </Before>
                        <After>
                          <Image source={{ uri: baseImageUri }} style={styles.compareImage} resizeMode="contain" />
                        </After>
                        <DefaultDragger />
                      </Compare>
                    </View>
                  ) : (
                    <Image source={{ uri: baseImageUri }} style={styles.cardImage} resizeMode="cover" />
                  )}

                  <View style={styles.compareLegendRow}>
                    <Text style={styles.compareLegendText}>{isDemoResult ? 'New (uploaded)' : 'After (AI)'}</Text>
                    <Text style={styles.compareLegendText}>{isDemoResult ? 'Old (red demo)' : 'Before (Original)'}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, busyStyle === style && styles.actionBtnDisabled]}
                      disabled={busyStyle === style}
                      onPress={() => downloadImage(style, result.url!)}>
                      <Ionicons name="download-outline" size={16} color="#E5E7EB" />
                      <Text style={styles.actionText}>Download</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, busyStyle === style && styles.actionBtnDisabled]}
                      disabled={busyStyle === style}
                      onPress={() => shareImage(style, result.url!)}>
                      <Ionicons name="share-social-outline" size={16} color="#E5E7EB" />
                      <Text style={styles.actionText}>Share</Text>
                    </Pressable>
                  </View>
                </>
              )}
              {result.status === 'failed' && (
                <View style={[styles.cardImage, styles.failedPlaceholder]}>
                  <Ionicons name="image-outline" size={40} color="#4B5563" />
                  <Text style={styles.failedText}>Failed to generate</Text>
                  <Pressable
                    style={[styles.retrySingleBtn, generatingStyle === style && styles.actionBtnDisabled]}
                    disabled={generatingStyle === style}
                    onPress={() => generateSingleStyle(style)}>
                    <Ionicons name="refresh-outline" size={14} color="#A5B4FC" />
                    <Text style={styles.retrySingleText}>
                      {generatingStyle === style ? 'Retrying...' : 'Retry this style'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F11',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F28',
  },
  backBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    width: 140,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#232333',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 999,
  },
  retryBtn: {
    padding: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2D0A0A',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#16161C',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#1F1F28',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusSuccess: {
    backgroundColor: '#064E3B',
  },
  statusFailed: {
    backgroundColor: '#2D0A0A',
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  cardImage: {
    width: '100%',
    height: 240,
  },
  compareContainer: {
    width: '100%',
    height: COMPARE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compareImage: {
    width: COMPARE_WIDTH,
    height: COMPARE_HEIGHT,
  },
  compareLegendRow: {
    marginTop: 6,
    marginHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compareLegendText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  failedPlaceholder: {
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  failedText: {
    color: '#6B7280',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
  retrySingleBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4C1D95',
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retrySingleText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '600',
  },
});
