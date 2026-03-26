import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

const MAX_UPLOAD_DIMENSION = 2048;

const normalizeImage = async (
  asset: ImagePicker.ImagePickerAsset
): Promise<ImagePickerResult> => {
  const largestSide = Math.max(asset.width, asset.height);

  if (largestSide <= MAX_UPLOAD_DIMENSION && asset.base64) {
    return {
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    };
  }

  const scale = MAX_UPLOAD_DIMENSION / largestSide;
  const targetWidth = Math.round(asset.width * scale);
  const targetHeight = Math.round(asset.height * scale);

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: targetWidth, height: targetHeight } }],
    {
      compress: 0.95,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!manipulated.base64) {
    throw new Error('Failed to optimize selected image');
  }

  return {
    uri: manipulated.uri,
    base64: manipulated.base64,
    width: manipulated.width,
    height: manipulated.height,
  };
};

export const pickImageFromGallery = async (): Promise<ImagePickerResult> => {
  try {

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      throw new Error('Permission to access media library is required!');
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if(result.canceled || !result.assets || result.assets.length === 0) {
      throw new Error('No image selected');
    }
    
    const asset = result.assets[0];
    
    return await normalizeImage(asset);

  } catch (error) {
    console.error('Gallery picker error:', error);
    throw error;
  }
};

export const pickImageFromCamera = async (): Promise<ImagePickerResult> => {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      throw new Error('Permission to access camera is required!');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if(result.canceled || !result.assets || result.assets.length === 0) {
      throw new Error('No image captured');
    }

    const asset = result.assets[0];
    
    return await normalizeImage(asset);
  } catch (error) {
    console.error('Camera picker error:', error);
    throw error;
  }
};

export const validateImage = (size: number, width: number, height: number): void => {

    const MAX_SIZE_MB = 5;
    const MAX_DIMENSION = 4000;

    if (size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`Image size exceeds ${MAX_SIZE_MB} MB`);
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Image dimensions exceed ${MAX_DIMENSION}x${MAX_DIMENSION} pixels`);
    }
};