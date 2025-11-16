export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type DefectCategory = 
  | 'walls' 
  | 'floor' 
  | 'ceiling' 
  | 'doors' 
  | 'windows' 
  | 'plumbing' 
  | 'electrical' 
  | 'heating' 
  | 'ventilation' 
  | 'finishing' 
  | 'tiles' 
  | 'paint' 
  | 'other';

export interface Owner {
  full_name: string | null;
  phone: string | null;
}

export interface ActPhoto {
  filename: string;
  url: string | null;
  confidence: number;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

export interface Defect {
  id: string;
  text_raw: string;
  description: string;
  category: DefectCategory;
  severity: Severity;
  suggested_deadline_days: number;
  photo_refs: string[];
  location_in_apartment: string | null;
  confidence: number;
}

export interface Metadata {
  source_ocr_text: string;
  processing_timestamp: string;
  image_gps: {
    lat: number | null;
    lon: number | null;
  };
}

export interface ApartmentCard {
  id?: string; // Unique ID for DB/Local storage
  userId?: string; // Owner ID to prevent data mixing
  upload_date?: string; // ISO String of when the photo was processed
  house_number: string | null;
  apartment_number: string | null;
  acceptance_date: string | null; // ISO YYYY-MM-DD
  owner: Owner;
  act_photos: ActPhoto[];
  defects: Defect[];
  metadata: Metadata;
  comments: Comment[]; // Changed from comment: string | null
  // Legacy support optional field (internal use during migration)
  comment?: string | null; 
}

export interface ProcessingResponse {
  apartment_card: ApartmentCard;
  errors: string[];
  warnings: string[];
}