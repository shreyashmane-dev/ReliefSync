export interface PredictionResult<T> {
  data: T;
  confidenceScore: number;
  modelId: string;
}

export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentCategory = 'MEDICAL' | 'FIRE' | 'FLOOD' | 'EARTHQUAKE' | 'SUPPLY_SHORTAGE' | 'OTHER';

export interface MLMetadata {
  priorityScore: number;
  reliabilityScore: number;
  nlpClassification: IncidentCategory;
}
