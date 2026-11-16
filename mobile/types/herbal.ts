export interface ScientificReference {
  id: number;
  herbal_id: number;
  title: string;
  author_year: string;
  evidence_level: 'Tradisional' | 'Laboratorium' | 'Uji Klinis';
  doi_or_url?: string;
}

export interface HerbalDetail {
  id: number;
  slug: string;
  name: string;
  scientific_name: string;
  local_name: string;
  description: string;
  plant_parts_used: string;
  traditional_usage: string;
  lab_evidence?: string;
  clinical_evidence?: string;
  safety_warning: string;
  image_url?: string | null;
  is_curated?: boolean;
  references: ScientificReference[];
}

export interface ScanHistoryItem {
  id: number;
  detected_slug: string;
  confidence_score: number;
  image_url?: string | null;
  created_at: string;
  plant_name: string;
  scientific_name: string;
  is_toxic: boolean;
}