import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StyleKey } from '@/src/services/clipartService';
import { setGenerationImage } from '@/src/services/generationSession';
import {
  ImagePickerResult,
  pickImageFromCamera,
  pickImageFromGallery,
  validateImage,
} from '@/src/services/imageService';
import { useRouter } from 'expo-router';

const AVAILABLE_STYLES: { key: StyleKey; label: string }[] = [
  { key: 'cartoon', label: 'Cartoon' },
  { key: 'flat', label: 'Flat' },
  { key: 'anime', label: 'Anime' },
  { key: 'pixel', label: 'Pixel' },
  { key: 'sketch', label: 'Sketch' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<ImagePickerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<StyleKey[]>([]);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [isOpeningGenerator, setIsOpeningGenerator] = useState(false);
  const router = useRouter();

  const toggleStyle = (style: StyleKey) => {
    setStyleError(null);
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const isUserCancelError = (err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    return (
      message.includes('canceled') ||
      message.includes('cancelled') ||
      message.includes('no image selected') ||
      message.includes('no image captured')
    );
  };

  const processImage = async (image: ImagePickerResult) => {
    const sizeBytes = Math.ceil((image.base64.length * 3) / 4);
    validateImage(sizeBytes, image.width, image.height);
    setSelectedImage(image);
  };

  const handleGalleryPick = async () => {
    try {
      setLoading(true);
      setError(null);
      const image = await pickImageFromGallery();
      await processImage(image);
    } catch (err) {
      if (isUserCancelError(err) && selectedImage) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to pick image');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraPick = async () => {
    try {
      setLoading(true);
      setError(null);
      const image = await pickImageFromCamera();
      await processImage(image);
    } catch (err) {
      if (isUserCancelError(err) && selectedImage) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to capture image');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setError(null);
  };

  const handleGenerate = () => {
    if (!selectedImage) return;

    if (selectedStyles.length === 0) {
      setStyleError('Please select at least one style before generating.');
      return;
    }

    setStyleError(null);
    setIsOpeningGenerator(true);
    setGenerationImage(selectedImage);

    requestAnimationFrame(() => {
      router.push({
        pathname: '/generation',
        params: {
          styles: selectedStyles.join(','),
        },
      });
      setIsOpeningGenerator(false);
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Math.max(insets.top, 10) }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✦ ClipX.AI</Text>
          </View>
          <Text style={styles.title}>Clipart Generator</Text>
          <Text style={styles.subtitle}>Transform your photo into stunning clipart styles</Text>
        </View>

        {/* Upload Zone */}
        {!selectedImage ? (
          <Pressable
            style={[styles.uploadZone, loading && styles.btnDisabled]}
            onPress={handleGalleryPick}
            disabled={loading}>
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Processing image...</Text>
              </View>
            ) : (
              <>
                <View style={styles.uploadIcon}>
                  <Ionicons name="cloud-upload-outline" size={40} color="#6366F1" />
                </View>
                <Text style={styles.uploadTitle}>Upload your photo</Text>
                <Text style={styles.uploadHint}>Tap to choose from gallery • JPG, PNG up to 5MB</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              contentFit="contain"
            />
            <Pressable style={styles.clearBtn} onPress={handleClear}>
              <Ionicons name="close-circle" size={28} color="#fff" />
            </Pressable>
            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaText}>
                {selectedImage.width} x {selectedImage.height}px
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Buttons */}
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.pickBtn, loading && styles.btnDisabled]}
            onPress={handleGalleryPick}
            disabled={loading}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={styles.pickBtnText}>Gallery</Text>
          </Pressable>

          <Pressable
            style={[styles.pickBtn, styles.pickBtnSecondary, loading && styles.btnDisabled]}
            onPress={handleCameraPick}
            disabled={loading}>
            <Ionicons name="camera-outline" size={20} color="#6366F1" />
            <Text style={[styles.pickBtnText, styles.pickBtnTextSecondary]}>Camera</Text>
          </Pressable>
        </View>

        {/* Generate CTA */}
        {selectedImage && (
          <Pressable
            style={[styles.generateBtn, (selectedStyles.length === 0 || isOpeningGenerator) && styles.btnDisabled]}
            disabled={selectedStyles.length === 0 || isOpeningGenerator}
            onPress={handleGenerate}>
            <Ionicons name="sparkles-outline" size={20} color="#fff" />
            <Text style={styles.generateBtnText}>
              {isOpeningGenerator ? 'Opening generator...' : 'Generate Clipart Styles'}
            </Text>
          </Pressable>
        )}

        {/* Style chips */}
        <Text style={styles.stylesTitle}>Choose effects (multi-select)</Text>
        <View style={styles.stylesRow}>
          {AVAILABLE_STYLES.map((style) => {
            const active = selectedStyles.includes(style.key);
            return (
              <Pressable
                key={style.key}
                onPress={() => toggleStyle(style.key)}
                style={[styles.styleChip, active && styles.styleChipActive]}>
                <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                  {style.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {styleError ? (
          <Text style={styles.stylesHint}>{styleError}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F11',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  badgeText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F9FAFB',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  uploadZone: {
    borderWidth: 1.5,
    borderColor: '#2D2D35',
    borderStyle: 'dashed',
    borderRadius: 20,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16161C',
    gap: 8,
  },
  uploadIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadHint: {
    color: '#6B7280',
    fontSize: 12,
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  previewWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    height: 280,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  clearBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  previewMeta: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewMetaText: {
    color: '#fff',
    fontSize: 11,
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2D0A0A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 14,
  },
  pickBtnSecondary: {
    backgroundColor: '#16161C',
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  pickBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  pickBtnTextSecondary: {
    color: '#6366F1',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  stylesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  stylesTitle: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  styleChip: {
    backgroundColor: '#1A1A22',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  styleChipActive: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
  },
  styleChipText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  styleChipTextActive: {
    color: '#E0E7FF',
  },
  stylesHint: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
});
