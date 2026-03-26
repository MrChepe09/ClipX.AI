import { ImagePickerResult } from '@/src/services/imageService';

interface GenerationSessionState {
  image: ImagePickerResult | null;
}

const state: GenerationSessionState = {
  image: null,
};

export const setGenerationImage = (image: ImagePickerResult) => {
  state.image = image;
};

export const getGenerationImage = () => state.image;

export const clearGenerationImage = () => {
  state.image = null;
};
