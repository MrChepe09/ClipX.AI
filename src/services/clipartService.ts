const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const API_SECRET = process.env.EXPO_PUBLIC_API_SECRET || '';

export type StyleKey = 'cartoon' | 'flat' | 'anime' | 'pixel' | 'sketch';

export interface StyleResult {
  status: 'success' | 'failed';
  url?: string;
  error?: string;
  style: StyleKey;
  note?: string;
}

export interface GenerateClipartResponse {
  success: boolean;
  results: Record<StyleKey, StyleResult>;
}

export const generateClipart = async (
  imageBase64: string,
  styles: StyleKey[]
): Promise<GenerateClipartResponse> => {
  const response = await fetch(`${API_URL}/api/generate-clipart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': API_SECRET,
    },
    body: JSON.stringify({ imageBase64, styles }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
};
