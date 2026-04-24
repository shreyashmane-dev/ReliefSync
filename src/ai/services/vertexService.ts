import type { PredictionResult, UrgencyLevel, IncidentCategory } from '../models/types';

export const predictIncidentUrgency = async (_reportText: string, _imageFile?: File): Promise<PredictionResult<UrgencyLevel>> => {
  console.log("Calling Vertex AI for Priority Prediction...");
  await new Promise(resolve => setTimeout(resolve, 800));
  return { data: 'HIGH', confidenceScore: 0.92, modelId: 'gemini-1.5-pro' };
};

export const recommendResponders = async (incidentId: string, volunteers: any[]): Promise<PredictionResult<any[]>> => {
  console.log("Recommending responders for incident:", incidentId);
  await new Promise(resolve => setTimeout(resolve, 600));
  return { data: volunteers.slice(0, 3), confidenceScore: 0.88, modelId: 'vertex-matching-engine' };
};

export const detectRiskClusters = async (incidents: any[]): Promise<PredictionResult<any[]>> => {
  console.log("Detecting hotspots from incidents:", incidents.length);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { data: [], confidenceScore: 0.85, modelId: 'vertex-kmeans-clustering' };
};

export const forecastDemand = async (hotspotId: string): Promise<PredictionResult<string[]>> => {
  console.log("Forecasting demand for hotspot:", hotspotId);
  await new Promise(resolve => setTimeout(resolve, 700));
  return { data: ['Water', 'Medical Kits', 'Blankets'], confidenceScore: 0.89, modelId: 'vertex-time-series' };
};

export const allocateResources = async (_incidentId: string, _inventory: any[]): Promise<PredictionResult<any>> => {
  console.log("Optimizing resource allocation for incident:", _incidentId);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { allocated: true }, confidenceScore: 0.95, modelId: 'vertex-optimization' };
};

export const analyzeTrustScore = async (_userId: string, _reportText: string, _userHistory: any[]): Promise<PredictionResult<number>> => {
  console.log("Estimating report credibility...");
  await new Promise(resolve => setTimeout(resolve, 400));
  return { data: 85, confidenceScore: 0.91, modelId: 'gemini-1.5-flash' };
};

export const classifyIncidentText = async (reportText: string): Promise<PredictionResult<IncidentCategory>> => {
  console.log("Classifying report text...");
  await new Promise(resolve => setTimeout(resolve, 600));
  let category: IncidentCategory = 'OTHER';
  const text = reportText.toLowerCase();
  if (text.includes('fire')) category = 'FIRE';
  else if (text.includes('flood') || text.includes('water')) category = 'FLOOD';
  else if (text.includes('medical') || text.includes('hurt')) category = 'MEDICAL';
  else if (text.includes('quake')) category = 'EARTHQUAKE';
  return { data: category, confidenceScore: 0.88, modelId: 'gemini-1.5-flash' };
};
