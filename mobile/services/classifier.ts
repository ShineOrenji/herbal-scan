import axios from 'axios';

export interface Candidate {
  slug: string;
  confidence: number;
}

export interface PredictionResult {
  slug: string;
  confidence: number;
  is_herbal: boolean;
  isHerbal: boolean;
  is_toxic?: boolean;
  message?: string;
  top_3?: Candidate[];
  source?: string;
}

// Sesuaikan IP laptop Linux Mint Anda
const PREDICT_URL = 'http://10.34.248.63:8000/api/v1/predict';

export const classifyImage = async (imageUri: string): Promise<PredictionResult> => {
  const formData = new FormData();

  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  // @ts-ignore
  formData.append('image', { uri: imageUri, name: filename, type });

  const response = await axios.post(PREDICT_URL, formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  timeout: 60000,
});

  const res = response.data?.data ?? response.data;
  const isHerbalFlag = Boolean(res.is_herbal ?? res.isHerbal);

  return {
    slug: res.slug,
    confidence: res.confidence,
    is_herbal: isHerbalFlag,
    isHerbal: isHerbalFlag,
    is_toxic: Boolean(res.is_toxic),
    message: res.message,
    top_3: Array.isArray(res.top_3) ? res.top_3 : [],
    source: res.source,
  };
};
