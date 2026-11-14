import axios from 'axios';
import { HerbalDetail } from '../types/herbal';

// Ganti IP sesuai alamat IP Wi-Fi laptop Linux Mint Anda
const BASE_URL = 'http://10.34.248.63:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export const getHerbalCatalog = async (): Promise<HerbalDetail[]> => {
  const response = await apiClient.get('/herbals');
  return response.data.data;
};

export const getHerbalBySlug = async (slug: string): Promise<HerbalDetail> => {
  const response = await apiClient.get(`/herbals/slug/${slug}`);
  return response.data.data;
};