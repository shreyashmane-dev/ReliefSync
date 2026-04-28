import { buildApiUrl } from '../../core/config/api';
import type { IncidentCategory, PredictionResult, UrgencyLevel } from '../models/types';

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
};

export const predictIncidentUrgency = async (
  reportText: string,
  _imageFile?: File,
): Promise<PredictionResult<UrgencyLevel>> => {
  const data = await postJson<any>('/api/ai/intelligence/triage', {
    incident: {
      title: 'Incident report',
      description: reportText,
      message: reportText,
    },
  });

  return {
    data: String(data.severity || 'medium').toUpperCase() as UrgencyLevel,
    confidenceScore: Number(data.confidenceScore || 0) / 100,
    modelId: 'vertex-intelligence-triage',
  };
};

export const recommendResponders = async (
  incidentId: string,
  volunteers: any[],
): Promise<PredictionResult<any[]>> => {
  const data = await postJson<any>('/api/ai/intelligence/match', {
    incident: { id: incidentId },
    volunteers,
  });

  return {
    data: data.topAssignments || [],
    confidenceScore: 0.9,
    modelId: 'vertex-intelligence-matching',
  };
};

export const detectRiskClusters = async (incidents: any[]): Promise<PredictionResult<any[]>> => {
  const data = await postJson<any>('/api/ai/intelligence/hotspots', { incidents });
  return {
    data: data.hotspots || [],
    confidenceScore: 0.88,
    modelId: 'vertex-intelligence-hotspots',
  };
};

export const forecastDemand = async (hotspotId: string): Promise<PredictionResult<string[]>> => {
  const data = await postJson<any>('/api/ai/intelligence/hotspots', {});
  const hotspot = (data.hotspots || []).find((entry: any) => entry.zone === hotspotId);

  return {
    data: hotspot
      ? [`Demand pressure ${hotspot.demandPressure}`, `Open incidents ${hotspot.open}`, `Coverage ${hotspot.volunteerCoverage}`]
      : [],
    confidenceScore: 0.84,
    modelId: 'vertex-intelligence-forecast',
  };
};

export const allocateResources = async (incidentId: string, inventory: any[]): Promise<PredictionResult<any>> => {
  const data = await postJson<any>('/api/ai/intelligence/resources', {
    incidentId,
    inventory,
  });

  return {
    data,
    confidenceScore: 0.9,
    modelId: 'vertex-intelligence-resource-optimizer',
  };
};

export const analyzeTrustScore = async (
  userId: string,
  reportText: string,
  userHistory: any[],
): Promise<PredictionResult<number>> => {
  const data = await postJson<any>('/api/ai/intelligence/trust', {
    report: {
      userId,
      description: reportText,
      message: reportText,
    },
    context: {
      history: userHistory,
    },
  });

  return {
    data: Number(data.credibilityScore || 0),
    confidenceScore: 0.86,
    modelId: 'vertex-intelligence-trust',
  };
};

export const classifyIncidentText = async (
  reportText: string,
): Promise<PredictionResult<IncidentCategory>> => {
  const data = await postJson<any>('/api/ai/intelligence/triage', {
    incident: {
      title: 'Incident report',
      description: reportText,
      message: reportText,
    },
  });

  const category = String(data.category || 'OTHER').toUpperCase();
  const mappedCategory: IncidentCategory =
    category === 'MEDICAL' || category === 'FIRE' || category === 'FLOOD' || category === 'EARTHQUAKE'
      ? category
      : category === 'SUPPLY'
        ? 'SUPPLY_SHORTAGE'
        : 'OTHER';

  return {
    data: mappedCategory,
    confidenceScore: Number(data.confidenceScore || 0) / 100,
    modelId: 'vertex-intelligence-classifier',
  };
};
