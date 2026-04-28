import { db } from '../config/firebase-admin.js';
import { getGeminiModel } from '../config/gemini.js';
import { getVertexConfigStatus } from '../config/vertex.js';

const RISK_KEYWORDS = {
  critical: ['collapsed', 'trapped', 'unconscious', 'not breathing', 'explosion', 'massive fire', 'severe bleeding'],
  high: ['fire', 'flood', 'injured', 'medical emergency', 'gas leak', 'short circuit', 'landslide'],
  medium: ['stranded', 'smoke', 'power outage', 'road blocked', 'water rising', 'evacuation'],
};

const CATEGORY_KEYWORDS = {
  FIRE: ['fire', 'smoke', 'burning', 'explosion'],
  FLOOD: ['flood', 'waterlogging', 'water rising', 'submerged', 'overflow'],
  MEDICAL: ['medical', 'injured', 'bleeding', 'unconscious', 'ambulance', 'burn', 'fracture'],
  EARTHQUAKE: ['earthquake', 'quake', 'tremor', 'building crack'],
  SHELTER: ['shelter', 'homeless', 'evacuate', 'relocation'],
  SUPPLY: ['food', 'water', 'medicine', 'blanket', 'oxygen'],
  RESCUE: ['trapped', 'rescue', 'missing', 'stuck'],
};

const ROLE_SYSTEM_PROMPTS = {
  admin:
    'You are the ReliefSync Command Center Copilot. Think like an operations strategist. Prioritize surge risk, responder allocation, escalation timing, trust and safety, and system bottlenecks. Respond with structured, concise operational guidance.',
  volunteer:
    'You are the ReliefSync Mission Assistant. Think like a field operations guide. Prioritize volunteer safety, route hazards, supply readiness, communication discipline, and when to request backup.',
  user:
    'You are the ReliefSync Emergency Reporting Assistant. Help users report accurately, give immediate safety guidance, and ask only high-value follow-up questions.',
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, precision = 2) => Number(Number(value || 0).toFixed(precision));

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value) => new Set(normalizeText(value).split(' ').filter(Boolean));

const overlapScore = (a, b) => {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const aLat = Number(lat1);
  const aLng = Number(lng1);
  const bLat = Number(lat2);
  const bLng = Number(lng2);
  if ([aLat, aLng, bLat, bLng].some((value) => Number.isNaN(value))) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1Rad = toRadians(aLat);
  const lat2Rad = toRadians(bLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const mapSeverityToScore = (severity) => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 95;
    case 'high':
      return 78;
    case 'medium':
      return 54;
    default:
      return 28;
  }
};

const mapSeverityLabel = (score) => {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

const inferCategory = (incident) => {
  const source = normalizeText(
    [incident.title, incident.description, incident.message, incident.category, incident.type].filter(Boolean).join(' ')
  );

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return category;
    }
  }

  return 'OTHER';
};

const inferKeywordRisk = (incidentText) => {
  const text = normalizeText(incidentText);
  let score = 20;

  for (const keyword of RISK_KEYWORDS.medium) {
    if (text.includes(keyword)) score += 8;
  }
  for (const keyword of RISK_KEYWORDS.high) {
    if (text.includes(keyword)) score += 14;
  }
  for (const keyword of RISK_KEYWORDS.critical) {
    if (text.includes(keyword)) score += 20;
  }

  return clamp(score);
};

const buildIncidentNarrative = (incident) =>
  [incident.title, incident.description, incident.message, incident.category, incident.location?.address]
    .filter(Boolean)
    .join(' ');

const inferResourceNeed = (incident, severityScore, category) => {
  const peopleAffected = Number(incident.peopleAffected || incident.reportDetails?.peopleAffected || 0);
  const baselineResponders = severityScore >= 85 ? 4 : severityScore >= 65 ? 3 : severityScore >= 40 ? 2 : 1;
  const responderAdjustment = peopleAffected >= 20 ? 3 : peopleAffected >= 8 ? 2 : peopleAffected >= 3 ? 1 : 0;

  const resources = {
    volunteers: baselineResponders + responderAdjustment,
    ambulance: category === 'MEDICAL' || category === 'RESCUE' ? 1 : 0,
    fireUnit: category === 'FIRE' ? 1 : 0,
    rescueVehicle: category === 'FLOOD' || category === 'RESCUE' ? 1 : 0,
    medicalKits: Math.max(1, Math.ceil((peopleAffected || baselineResponders) / 3)),
    foodPacks: category === 'SUPPLY' || category === 'SHELTER' ? Math.max(2, peopleAffected) : 0,
  };

  return resources;
};

const computeCredibilityScore = (incident, history = []) => {
  const text = buildIncidentNarrative(incident);
  let score = 70;

  if (!incident.location?.lat || !incident.location?.lng) score -= 12;
  if (text.length < 20) score -= 15;
  if (!incident.title) score -= 6;
  if (incident.imageUrls?.length) score += 10;
  if (incident.voiceTranscript) score += 4;
  if (incident.isAnonymous) score -= 8;

  const repeatedSimilarReports = history.filter((entry) => overlapScore(text, buildIncidentNarrative(entry)) > 0.88).length;
  if (repeatedSimilarReports > 2) score -= 10;

  return clamp(score);
};

const computeSuspicionScore = (incident, history = []) => {
  const text = buildIncidentNarrative(incident);
  let score = 12;

  if (text.length < 12) score += 18;
  if (incident.isAnonymous) score += 8;
  if (!incident.location?.address && (!incident.location?.lat || !incident.location?.lng)) score += 16;
  if (history.length >= 3) score += 12;
  if (overlapScore(text, text.split(' ').slice(0, 4).join(' ')) > 0.9) score += 4;

  return clamp(score);
};

const detectDuplicateIncident = (incident, historicalIncidents = []) => {
  const narrative = buildIncidentNarrative(incident);
  const comparisons = historicalIncidents
    .map((existing) => {
      const textSimilarity = overlapScore(narrative, buildIncidentNarrative(existing));
      const distanceKm = calculateDistanceKm(
        incident.location?.lat,
        incident.location?.lng,
        existing.location?.lat,
        existing.location?.lng
      );
      const geoScore = distanceKm == null ? 0 : distanceKm < 0.5 ? 1 : distanceKm < 2 ? 0.6 : 0;
      const duplicateProbability = round((textSimilarity * 0.7 + geoScore * 0.3) * 100);

      return {
        incidentId: existing.id || existing.incidentId || null,
        duplicateProbability,
        distanceKm: distanceKm == null ? null : round(distanceKm),
        title: existing.title || existing.message || 'Existing incident',
      };
    })
    .sort((a, b) => b.duplicateProbability - a.duplicateProbability);

  return comparisons[0] || { incidentId: null, duplicateProbability: 0, distanceKm: null, title: null };
};

const scoreVolunteer = (incident, volunteer, allAssignments = []) => {
  const requiredSkills = incident.requiredSkills || incident.skillsNeeded || [];
  const volunteerSkills = volunteer.skills || volunteer.capabilities || [];
  const matchedSkills = requiredSkills.filter((skill) =>
    volunteerSkills.map((entry) => String(entry).toLowerCase()).includes(String(skill).toLowerCase())
  ).length;
  const skillFit = requiredSkills.length ? (matchedSkills / requiredSkills.length) * 100 : volunteerSkills.length ? 72 : 48;

  const distanceKm = calculateDistanceKm(
    incident.location?.lat,
    incident.location?.lng,
    volunteer.location?.lat,
    volunteer.location?.lng
  );
  const etaMinutes = distanceKm == null ? 45 : Math.max(5, Math.round(distanceKm * 4.5));
  const etaScore = distanceKm == null ? 35 : clamp(100 - distanceKm * 9);
  const reliability = clamp(Number(volunteer.reliabilityScore || volunteer.rating || (volunteer.completedTasks ? 60 + volunteer.completedTasks : 62)));
  const taskLoad = Number(volunteer.activeTasks || volunteer.currentTaskLoad || 0);
  const workloadBalance = clamp(100 - taskLoad * 22);
  const tierScore = volunteer.tier === 'critical-response' ? 100 : volunteer.tier === 'priority' ? 88 : volunteer.tier === 'standard' ? 72 : 58;
  const localKnowledge = volunteer.location?.area && incident.location?.area && volunteer.location.area === incident.location.area ? 100 : 64;
  const fatigueScore = clamp(100 - Number(volunteer.fatigueScore || volunteer.recentMissionCount || 0) * 12);

  const score =
    skillFit * 0.3 +
    etaScore * 0.2 +
    reliability * 0.15 +
    workloadBalance * 0.1 +
    tierScore * 0.1 +
    localKnowledge * 0.1 +
    fatigueScore * 0.05;

  return {
    volunteerId: volunteer.id,
    name: volunteer.name || 'Volunteer',
    distanceKm: distanceKm == null ? null : round(distanceKm),
    etaMinutes,
    score: round(score),
    skillFit: round(skillFit),
    reliability: round(reliability),
    workloadBalance: round(workloadBalance),
    tierScore: round(tierScore),
    localKnowledge: round(localKnowledge),
    fatigueScore: round(fatigueScore),
    availability: volunteer.status || 'available',
    explanation:
      `Skill fit ${round(skillFit)}. ETA ${etaMinutes} min. Reliability ${round(reliability)}. ` +
      `Task load ${taskLoad}. Tier ${volunteer.tier || 'standard'}.`,
  };
};

const summarizeAssignments = (rankedResponders) => {
  const top = rankedResponders.slice(0, 3);
  return top.map((responder, index) => ({
    rank: index + 1,
    volunteerId: responder.volunteerId,
    name: responder.name,
    score: responder.score,
    etaMinutes: responder.etaMinutes,
    reason: responder.explanation,
  }));
};

const computeMissionFailureRisk = (incident, assignedResponders = []) => {
  const severityScore = mapSeverityToScore(incident.severity || mapSeverityLabel(inferKeywordRisk(buildIncidentNarrative(incident))));
  const averageReliability =
    assignedResponders.length > 0
      ? assignedResponders.reduce((sum, responder) => sum + Number(responder.reliability || responder.reliabilityScore || 60), 0) / assignedResponders.length
      : 45;
  const averageTaskLoad =
    assignedResponders.length > 0
      ? assignedResponders.reduce((sum, responder) => sum + Number(responder.activeTasks || 0), 0) / assignedResponders.length
      : 2;

  const score = clamp(severityScore * 0.45 + (100 - averageReliability) * 0.35 + averageTaskLoad * 10);
  return round(score);
};

const buildFallbackRoleReply = (role, message, context = {}) => {
  if (role === 'admin') {
    return `Command assessment: ${message}. Top priorities are incident queue balancing, backup readiness, and responder coverage gaps. Review critical incidents first, then rebalance teams toward the highest delay-risk zone.`;
  }

  if (role === 'volunteer') {
    return `Field guidance: ${message}. Confirm your route, carry core medical and communication supplies, keep location updates live, and request backup immediately if hazards escalate or casualty count grows.`;
  }

  return `Emergency guidance: ${message}. Share exact location, number of people affected, visible hazards, and whether anyone is trapped or injured. Move to immediate safety if conditions worsen.`;
};

const detectCopilotIntent = (role, message) => {
  const text = normalizeText(message);
  const hasTaskWord = text.includes('task') || text.includes('tasks') || text.includes('mission') || text.includes('missions') || text.includes('job') || text.includes('jobs');

  if (
    text === 'find tasks' ||
    text === 'find task' ||
    text === 'available tasks' ||
    text === 'available task' ||
    text === 'open missions' ||
    text === 'open mission' ||
    text === 'find jobs' ||
    text === 'available jobs' ||
    (hasTaskWord && (text.includes('find') || text.includes('available') || text.includes('open') || text.includes('show open') || text.includes('list open')))
  ) {
    return 'find_tasks';
  }

  if (
    text === 'my tasks' ||
    text === 'my task' ||
    text === 'active tasks' ||
    text === 'active task' ||
    text === 'my active tasks' ||
    text === 'current task' ||
    text === 'current mission' ||
    text === 'my mission' ||
    text === 'my missions' ||
    text === 'done task' ||
    text === 'my history' ||
    text.includes('my active task') ||
    text.includes('my active mission') ||
    text.includes('my tasks') ||
    text.includes('assigned task') ||
    text.includes('current task') ||
    (hasTaskWord && (text.includes('my') || text.includes('current') || text.includes('assigned') || text.includes('history') || text.includes('done')))
  ) {
    return 'my_tasks';
  }

  if (text.includes('triage') || text.includes('classify') || text.includes('severity') || text.includes('incident')) {
    return 'triage';
  }
  if (text.includes('match') || text.includes('assign') || text.includes('volunteer') || text.includes('responder')) {
    return 'matching';
  }
  if (text.includes('backup') || text.includes('escalat') || text.includes('stall') || text.includes('fail')) {
    return 'escalation';
  }
  if (text.includes('hotspot') || text.includes('zone') || text.includes('surge') || text.includes('cluster') || text.includes('coverage')) {
    return 'hotspots';
  }
  if (text.includes('resource') || text.includes('supply') || text.includes('redeploy') || text.includes('allocation')) {
    return 'resources';
  }
  if (text.includes('trust') || text.includes('fake') || text.includes('abuse') || text.includes('suspicious') || text.includes('fraud')) {
    return 'trust';
  }
  if (role === 'admin' && (text.includes('overview') || text.includes('status') || text.includes('summary') || text.includes('dashboard'))) {
    return 'overview';
  }
  if (role === 'volunteer' && (text.includes('route') || text.includes('risk scan') || text.includes('protocol') || text.includes('directions'))) {
    return 'field_guidance';
  }
  if (role === 'user' && (text.includes('report') || text.includes('emergency') || text.includes('help') || text.includes('safe'))) {
    return 'user_guidance';
  }

  return 'general';
};

const chooseReferenceIncident = async (context = {}) => {
  if (context.incident) return context.incident;
  if (context.hotspots?.length) {
    return {
      id: 'hotspot-priority',
      title: `${context.hotspots[0].zone} surge`,
      description: `Open incidents ${context.hotspots[0].open}, critical ${context.hotspots[0].critical}`,
      location: { area: context.hotspots[0].zone },
      severity: context.hotspots[0].critical > 0 ? 'high' : 'medium',
    };
  }

  const incidents = await getRecentIncidents(10);
  return incidents.find((incident) => !['resolved', 'closed', 'completed'].includes(String(incident.status || '').toLowerCase())) || incidents[0] || null;
};

const formatActionList = (items) => items.filter(Boolean).map((item) => `- ${item}`).join('\n');

const buildDeterministicCopilotReply = async (service, role, message, userData, context) => {
  const intent = detectCopilotIntent(role, message);

  if (intent === 'my_tasks') {
    const tasks = await getVolunteerAssignedTasks(userData?.id, 12);
    const activeTasks = tasks.filter(
      (task) => !['completed', 'resolved'].includes(String(task.status || '').toLowerCase()) &&
        !['completed', 'resolved'].includes(String(task.missionStatus || '').toLowerCase())
    );
    const current = activeTasks[0];

    return {
      reply: current
        ? `You currently have ${activeTasks.length} active mission${activeTasks.length > 1 ? 's' : ''}. Top active mission: ${formatTaskLine(current)}.`
        : tasks.length > 0
          ? `You do not have an active mission right now, but you have ${tasks.length} completed or archived assignment records.`
          : 'You do not have any assigned tasks right now.',
      nextActions: activeTasks.slice(0, 5).map((task) => `Open task ${task.id.slice(-6)}: ${formatTaskLine(task)}`),
      riskFlags: activeTasks.length === 0 ? ['No active assignments'] : [],
      suggestedTools: ['my-tasks', current ? `task:${current.id}` : 'jobs-board'],
    };
  }

  if (intent === 'find_tasks') {
    const jobs = await getOpenVolunteerTasks(12);
    const rankedJobs = jobs
      .map((job) => {
        const text = normalizeText([job.title, job.description, job.category, job.severity].filter(Boolean).join(' '));
        let relevance = 50;
        if (text.includes('medical')) relevance += 8;
        if (text.includes('critical')) relevance += 12;
        if (text.includes('fire')) relevance += 10;
        if (text.includes('flood')) relevance += 10;
        return { ...job, relevance };
      })
      .sort((a, b) => b.relevance - a.relevance);

    const best = rankedJobs[0];
    return {
      reply: best
        ? `I found ${rankedJobs.length} available mission${rankedJobs.length > 1 ? 's' : ''}. Best immediate option: ${formatTaskLine(best)}.`
        : 'There are no open volunteer tasks available right now.',
      nextActions: rankedJobs.slice(0, 5).map((task) => `Available: ${formatTaskLine(task)}`),
      riskFlags: best ? [] : ['No open missions currently available'],
      suggestedTools: ['jobs-board', best ? `claim:${best.id}` : 'refresh-jobs'],
    };
  }

  if (intent === 'overview') {
    const brief = await service.getCommandCenterBrief();
    return {
      reply:
        `Operational overview: ${brief.overview?.activeIncidents || 0} active incidents, ` +
        `${brief.overview?.criticalOpen || 0} critical open, ` +
        `${brief.overview?.availableVolunteers || 0} available volunteers, and ` +
        `${brief.overview?.unreadAlerts || 0} unread alerts.`,
      nextActions: brief.strategicRecommendations || [],
      riskFlags: (brief.underservedAreas || []).slice(0, 3).map((entry) => `Underserved: ${entry.zone}`),
      suggestedTools: ['command-center', 'hotspot-map', 'resource-optimizer'],
    };
  }

  if (intent === 'hotspots') {
    const hotspots = await service.analyzeHotspots(context);
    const top = hotspots.hotspots[0];
    return {
      reply: top
        ? `Hotspot watch: ${top.zone} is the highest-pressure zone with ${top.open} open incidents, ${top.critical} critical cases, and demand pressure ${top.demandPressure}.`
        : 'No dominant hotspot is active right now.',
      nextActions: [
        hotspots.forecast,
        ...(hotspots.underservedAreas || []).slice(0, 2).map((entry) => `Increase coverage in ${entry.zone}.`),
      ].filter(Boolean),
      riskFlags: (hotspots.underservedAreas || []).slice(0, 3).map((entry) => `Coverage gap in ${entry.zone}`),
      suggestedTools: ['hotspot-forecast', 'coverage-heatmap'],
    };
  }

  if (intent === 'resources') {
    const plan = await service.optimizeResources(context);
    return {
      reply: plan.shortagePrediction || 'Resource posture is stable.',
      nextActions: [
        plan.prepositioningAdvice,
        ...(plan.redeployments || []).map((move) => `Redeploy from ${move.from} to ${move.to}.`),
      ].filter(Boolean),
      riskFlags: plan.redeployments?.length ? [] : ['No excess donor zones found'],
      suggestedTools: ['resource-optimizer', 'redeployment-plan'],
    };
  }

  if (intent === 'matching') {
    const incident = await chooseReferenceIncident(context);
    const volunteers = context.volunteers || (await getVolunteers(25));
    if (!incident) {
      return {
        reply: 'I do not have an active incident to assign right now.',
        nextActions: [],
        riskFlags: ['Missing active incident context'],
        suggestedTools: ['incident-feed'],
      };
    }

    const match = await service.matchVolunteers(incident, volunteers, context);
    const best = match.topAssignments[0];
    return {
      reply: best
        ? `Best assignment is ${best.name} with match score ${best.score} and ETA ${best.etaMinutes} minutes for ${incident.title || 'the active incident'}.`
        : 'No eligible volunteers are available for assignment.',
      nextActions: match.topAssignments.map((entry) => `Rank ${entry.rank}: ${entry.name} (${entry.etaMinutes} min ETA).`),
      riskFlags: best ? [] : ['Volunteer availability gap'],
      suggestedTools: ['matching-engine', 'backup-bench'],
    };
  }

  if (intent === 'escalation') {
    const incident = await chooseReferenceIncident(context);
    const volunteers = context.volunteers || (await getVolunteers(25));
    if (!incident) {
      return {
        reply: 'I do not have an active mission to evaluate for escalation.',
        nextActions: [],
        riskFlags: ['Missing active mission context'],
        suggestedTools: ['incident-feed'],
      };
    }

    const match = await service.matchVolunteers(incident, volunteers, context);
    const escalation = await service.evaluateEscalation(incident, context.assignedResponders || [], match.rankedResponders);
    return {
      reply: escalation.needsBackup
        ? `Escalation recommended. Mission failure risk is ${escalation.missionFailureRisk} and ${escalation.recommendedBackupCount} backup responder(s) should be prepared.`
        : `No escalation needed yet. Mission failure risk is ${escalation.missionFailureRisk}.`,
      nextActions: [
        escalation.escalationReason,
        ...escalation.bestBackupResponders.map((entry) => `Backup candidate: ${entry.name || entry.volunteerId}`),
      ].filter(Boolean),
      riskFlags: escalation.needsBackup ? ['Mission failure risk rising'] : [],
      suggestedTools: ['escalation-engine', 'backup-dispatch'],
    };
  }

  if (intent === 'trust') {
    const incident = await chooseReferenceIncident(context);
    if (!incident) {
      return {
        reply: 'No current report is available for trust analysis.',
        nextActions: [],
        riskFlags: ['Missing report context'],
        suggestedTools: ['trust-console'],
      };
    }

    const trust = await service.assessTrustSafety(incident, context);
    return {
      reply: `Trust scan complete. Credibility ${trust.credibilityScore}, fake-report probability ${trust.fakeReportProbability}, abuse risk ${trust.abuseRiskScore}.`,
      nextActions: [trust.moderationRecommendation],
      riskFlags: trust.fakeReportProbability >= 60 ? ['Suspicious report'] : [],
      suggestedTools: ['trust-and-safety', 'moderation-queue'],
    };
  }

  if (intent === 'triage') {
    const incident = context.incident || {
      title: message,
      description: message,
      message,
      location: context.location || userData?.location || null,
    };
    const triage = await service.triageIncident(incident, context);
    return {
      reply:
        `Triage result: ${triage.severity.toUpperCase()} ${triage.category}. ` +
        `Urgency ${triage.urgencyScore}, risk ${triage.riskScore}, credibility ${triage.credibilityScore}.`,
      nextActions: triage.recommendedActions,
      riskFlags: triage.suspiciousSignals,
      suggestedTools: ['triage-engine', 'dispatch-queue'],
    };
  }

  if (intent === 'field_guidance') {
    return {
      reply:
        'Field guidance: verify the route before departure, carry medical and communication essentials, and keep check-ins active every few minutes in unstable zones.',
      nextActions: [
        'Confirm safest route before departure.',
        'Carry first-aid, flashlight, water, and charged phone.',
        'Request backup immediately if casualty count or hazard level rises.',
      ],
      riskFlags: [],
      suggestedTools: ['route-guidance', 'backup-policy'],
    };
  }

  if (intent === 'user_guidance') {
    return {
      reply:
        'Emergency reporting mode: share exact location, number of affected people, visible hazards, and whether anyone is trapped, bleeding, or unconscious.',
      nextActions: [
        'Send exact location or nearest landmark.',
        'State injuries, fire, water level, or structural danger clearly.',
        'Move to immediate safety while waiting for responders.',
      ],
      riskFlags: [],
      suggestedTools: ['report-assistant', 'safety-guidance'],
    };
  }

  return null;
};

const requestStructuredJson = async (instruction, payload, fallback) => {
  try {
    const model = getGeminiModel();
    const prompt = `${instruction}\nReturn ONLY valid JSON.\nInput:\n${JSON.stringify(payload)}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (_error) {
    return fallback;
  }
};

const getRecentIncidents = async (limitCount = 25) => {
  if (!db) return [];

  try {
    const snapshot = await db.collection('reports').limit(limitCount).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (_error) {
    return [];
  }
};

const getVolunteers = async (limitCount = 50) => {
  if (!db) return [];

  try {
    const snapshot = await db.collection('volunteers').limit(limitCount).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (_error) {
    return [];
  }
};

const getNotifications = async (limitCount = 50) => {
  if (!db) return [];

  try {
    const snapshot = await db.collection('notifications').limit(limitCount).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (_error) {
    return [];
  }
};

const getVolunteerAssignedTasks = async (volunteerId, limitCount = 10) => {
  if (!db || !volunteerId) return [];

  try {
    const snapshot = await db
      .collection('reports')
      .where('assignedTo', '==', volunteerId)
      .limit(limitCount)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = Number(a.updatedAt?.seconds || a.assignedAt?.seconds || 0);
        const bTime = Number(b.updatedAt?.seconds || b.assignedAt?.seconds || 0);
        return bTime - aTime;
      });
  } catch (_error) {
    return [];
  }
};

const getOpenVolunteerTasks = async (limitCount = 10) => {
  if (!db) return [];

  try {
    const snapshot = await db
      .collection('reports')
      .where('status', 'in', ['open', 'pending', 'notifying'])
      .limit(limitCount)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((entry) => !entry.assignedTo);
  } catch (_error) {
    return [];
  }
};

const formatTaskLine = (task) => {
  const status = task.missionStatus || task.status || 'assigned';
  const location = typeof task.location === 'string' ? task.location : task.location?.address || task.location?.area || 'location unavailable';
  return `${task.title || 'Untitled mission'} [${String(status).replace('_', ' ')}] at ${location}`;
};

const getTaskLocation = (task) =>
  typeof task.location === 'string' ? task.location : task.location?.address || task.location?.area || 'location unavailable';

const buildVolunteerSuggestions = (items) => items.filter(Boolean).slice(0, 4);

export const vertexIntelligenceService = {
  async triageIncident(incident, options = {}) {
    const history = options.history || (await getRecentIncidents());
    const narrative = buildIncidentNarrative(incident);
    const category = inferCategory(incident);
    const keywordRisk = inferKeywordRisk(narrative);
    const peopleAffected = Number(incident.peopleAffected || incident.reportDetails?.peopleAffected || 0);
    const severityScore = clamp(keywordRisk + Math.min(peopleAffected * 5, 20));
    const severity = mapSeverityLabel(severityScore);
    const urgencyScore = clamp(severityScore * 0.75 + (incident.location?.address ? 8 : 0) + (peopleAffected > 0 ? 10 : 0));
    const riskScore = clamp(severityScore * 0.7 + (category === 'FIRE' || category === 'MEDICAL' ? 15 : 5));
    const duplicateMatch = detectDuplicateIncident(incident, history.filter((entry) => entry.id !== incident.id));
    const credibilityScore = computeCredibilityScore(incident, history);
    const fakeReportProbability = clamp(100 - credibilityScore + computeSuspicionScore(incident, history));
    const confidenceScore = clamp((credibilityScore * 0.45) + (100 - duplicateMatch.duplicateProbability) * 0.2 + 25);
    const resources = inferResourceNeed(incident, severityScore, category);
    const priorityIndex = round(
      severityScore * 0.3 +
        urgencyScore * 0.25 +
        riskScore * 0.15 +
        credibilityScore * 0.1 +
        Math.min(peopleAffected * 6, 20) * 0.1 +
        (100 - duplicateMatch.duplicateProbability) * 0.1
    );

    const structuredFallback = {
      summary: `${severity.toUpperCase()} ${category} incident. Prioritize ${resources.volunteers} responders.`,
      suspiciousSignals:
        fakeReportProbability >= 65
          ? ['Low-information report', 'Credibility below threshold']
          : [],
      likelyNeeds: Object.entries(resources)
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${value} ${key}`),
      recommendedActions: [
        severity === 'critical' ? 'Trigger rapid acknowledgement workflow.' : 'Queue normal dispatch workflow.',
        duplicateMatch.duplicateProbability >= 70 ? 'Merge with matching incident for operator review.' : 'Keep as standalone incident.',
      ],
    };

    const reasoning = await requestStructuredJson(
      'You are ReliefSync Vertex Intelligence. Enrich this emergency triage result with operational summary, suspicious signals, likely needs, and recommended actions.',
      {
        incident,
        computed: {
          category,
          severity,
          severityScore,
          urgencyScore,
          riskScore,
          credibilityScore,
          fakeReportProbability,
          duplicateMatch,
          resources,
        },
      },
      structuredFallback
    );

    return {
      incidentId: incident.id || incident.reportId || null,
      category,
      severity,
      severityScore: round(severityScore),
      urgencyScore: round(urgencyScore),
      riskScore: round(riskScore),
      credibilityScore: round(credibilityScore),
      confidenceScore: round(confidenceScore),
      duplicateProbability: duplicateMatch.duplicateProbability,
      duplicateMatch,
      fakeReportProbability: round(fakeReportProbability),
      suspicious: fakeReportProbability >= 65,
      priorityIndex,
      resourceEstimate: resources,
      recommendedActions: reasoning.recommendedActions || structuredFallback.recommendedActions,
      likelyNeeds: reasoning.likelyNeeds || structuredFallback.likelyNeeds,
      suspiciousSignals: reasoning.suspiciousSignals || structuredFallback.suspiciousSignals,
      summary: reasoning.summary || structuredFallback.summary,
    };
  },

  async matchVolunteers(incident, volunteers = [], options = {}) {
    const availableVolunteers = volunteers.length ? volunteers : await getVolunteers();
    const rankedResponders = availableVolunteers
      .filter((volunteer) => volunteer.approved !== false && volunteer.isAvailable !== false)
      .map((volunteer) => scoreVolunteer(incident, volunteer, options.currentAssignments || []))
      .sort((a, b) => b.score - a.score);

    const topAssignments = summarizeAssignments(rankedResponders);
    const backupBench = rankedResponders.slice(3, 8).map((responder) => ({
      volunteerId: responder.volunteerId,
      name: responder.name,
      score: responder.score,
      etaMinutes: responder.etaMinutes,
    }));

    return {
      incidentId: incident.id || incident.reportId || null,
      rankedResponders,
      topAssignments,
      backupBench,
      assignmentStrategy:
        topAssignments.length > 0
          ? `Dispatch ${topAssignments[0].name} first, then hold ${topAssignments.slice(1).map((entry) => entry.name).join(', ')} as immediate support.`
          : 'No eligible volunteers were found.',
    };
  },

  async evaluateEscalation(incident, assignedResponders = [], candidateResponders = []) {
    const missionFailureRisk = computeMissionFailureRisk(incident, assignedResponders);
    const responseStallRisk = clamp(
      Number(incident.responseDelayMinutes || 0) * 4 +
        Number(incident.unansweredNotifications || 0) * 12 +
        (assignedResponders.length === 0 ? 18 : 0)
    );
    const needsBackup = missionFailureRisk >= 60 || responseStallRisk >= 55;
    const recommendedBackupCount =
      missionFailureRisk >= 85 ? 3 : missionFailureRisk >= 65 || responseStallRisk >= 70 ? 2 : needsBackup ? 1 : 0;

    const backupResponders = candidateResponders
      .slice()
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, recommendedBackupCount);

    return {
      incidentId: incident.id || incident.reportId || null,
      needsBackup,
      missionFailureRisk,
      responseStallRisk,
      recommendedBackupCount,
      bestBackupResponders: backupResponders,
      escalationReason:
        needsBackup
          ? 'Escalation recommended due to rising mission-failure risk, slow response, or capability gap.'
          : 'Current assignment is stable. Continue monitoring for SLA breach or hazard escalation.',
    };
  },

  async analyzeHotspots(options = {}) {
    const incidents = options.incidents || (await getRecentIncidents(60));
    const volunteers = options.volunteers || (await getVolunteers(60));

    const zoneMap = new Map();
    for (const incident of incidents) {
      const zone = incident.location?.area || incident.location?.address || 'Unknown Zone';
      const entry = zoneMap.get(zone) || { zone, incidents: 0, critical: 0, open: 0 };
      entry.incidents += 1;
      if (String(incident.severity || '').toLowerCase() === 'critical') entry.critical += 1;
      if (!['resolved', 'closed', 'completed'].includes(String(incident.status || '').toLowerCase())) entry.open += 1;
      zoneMap.set(zone, entry);
    }

    const volunteerCoverage = volunteers.reduce((acc, volunteer) => {
      const zone = volunteer.location?.area || 'Unknown Zone';
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {});

    const hotspots = [...zoneMap.values()]
      .map((entry) => {
        const coverage = volunteerCoverage[entry.zone] || 0;
        const demandPressure = round(entry.open * 18 + entry.critical * 12 - coverage * 6);
        return {
          ...entry,
          volunteerCoverage: coverage,
          demandPressure,
          underserved: coverage < Math.max(1, Math.ceil(entry.open / 2)),
        };
      })
      .sort((a, b) => b.demandPressure - a.demandPressure);

    return {
      hotspots: hotspots.slice(0, 8),
      underservedAreas: hotspots.filter((entry) => entry.underserved).slice(0, 5),
      forecast:
        hotspots.length > 0
          ? `Next surge likely in ${hotspots[0].zone}. Demand pressure ${hotspots[0].demandPressure}.`
          : 'No clear hotspot surge detected.',
    };
  },

  async optimizeResources(options = {}) {
    const hotspots = options.hotspots || (await this.analyzeHotspots(options)).hotspots;
    const volunteers = options.volunteers || (await getVolunteers(60));
    const topHotspot = hotspots[0] || null;

    const availableByZone = volunteers.reduce((acc, volunteer) => {
      const zone = volunteer.location?.area || 'Unknown Zone';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(volunteer);
      return acc;
    }, {});

    const redeployments = [];
    if (topHotspot) {
      const donorZones = Object.entries(availableByZone)
        .filter(([zone, entries]) => zone !== topHotspot.zone && entries.length > 2)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 2);

      for (const [zone, entries] of donorZones) {
        redeployments.push({
          from: zone,
          to: topHotspot.zone,
          volunteers: entries.slice(0, Math.min(2, entries.length - 1)).map((entry) => entry.id),
        });
      }
    }

    return {
      redeployments,
      shortagePrediction:
        topHotspot && topHotspot.demandPressure > 40
          ? `${topHotspot.zone} likely to face responder shortage soon.`
          : 'No major responder shortage predicted.',
      prepositioningAdvice:
        topHotspot
          ? `Pre-position medical kits and one standby team near ${topHotspot.zone}.`
          : 'Maintain current resource distribution.',
    };
  },

  async assessTrustSafety(report, context = {}) {
    const history = context.history || (await getNotifications(40));
    const credibilityScore = computeCredibilityScore(report, history);
    const fakeReportProbability = clamp(100 - credibilityScore + computeSuspicionScore(report, history));
    const abuseRiskScore = clamp(fakeReportProbability * 0.65 + (context.complaintCount || 0) * 8 + (context.flagCount || 0) * 10);
    const moderationRecommendation =
      abuseRiskScore >= 75
        ? 'Escalate to admin moderation queue before dispatch.'
        : abuseRiskScore >= 50
          ? 'Allow dispatch recommendations but require manual verification.'
          : 'Low abuse risk. Normal workflow allowed.';

    return {
      credibilityScore,
      fakeReportProbability,
      abuseRiskScore,
      moderationRecommendation,
      volunteerReliabilityRisk: clamp(Number(context.volunteerReliabilityRisk || 0)),
      complaintRiskScore: clamp(Number(context.complaintRiskScore || abuseRiskScore * 0.8)),
    };
  },

  async screenVolunteerApplicant(applicant) {
    const completion = applicant.completedMissions || 0;
    const profileQualityScore = clamp(
      (applicant.name ? 20 : 0) +
        (applicant.phone ? 20 : 0) +
        (applicant.skills?.length ? 20 : 0) +
        (applicant.location?.address ? 20 : 0) +
        (applicant.documentsVerified ? 20 : 0)
    );
    const contributionScore = clamp(45 + completion * 6 + Number(applicant.communityHours || 0) * 1.5);
    const trustScore = clamp(profileQualityScore * 0.45 + contributionScore * 0.35 + (applicant.documentsVerified ? 20 : 0));
    const suitability =
      trustScore >= 80 ? 'recommended' : trustScore >= 60 ? 'review carefully' : 'do not recommend';

    return {
      applicantId: applicant.id || null,
      profileQualityScore,
      contributionScore,
      trustScore,
      suitability,
      finalApproval: 'admin_required',
    };
  },

  async listVolunteerTasks(volunteerId) {
    const tasks = await getVolunteerAssignedTasks(volunteerId, 20);
    const activeTasks = tasks.filter(
      (task) =>
        !['completed', 'resolved'].includes(String(task.status || '').toLowerCase()) &&
        !['completed', 'resolved'].includes(String(task.missionStatus || '').toLowerCase())
    );

    return {
      tasks,
      activeTasks,
      summary: activeTasks.length > 0
        ? `You have ${activeTasks.length} active mission${activeTasks.length > 1 ? 's' : ''}.`
        : tasks.length > 0
          ? 'You have no active missions right now.'
          : 'You have no assigned tasks right now.',
    };
  },

  async listOpenTasks() {
    const tasks = await getOpenVolunteerTasks(20);
    return {
      tasks,
      summary: tasks.length > 0
        ? `There are ${tasks.length} open mission${tasks.length > 1 ? 's' : ''} available right now.`
        : 'There are no open missions available right now.',
    };
  },

  async handleVolunteerOperationsQuery({ volunteerId, query }) {
    const normalizedQuery = normalizeText(query);
    const tasksPayload = await this.listVolunteerTasks(volunteerId);
    const openPayload = await this.listOpenTasks();
    const activeTasks = tasksPayload.activeTasks || [];
    const allTasks = tasksPayload.tasks || [];
    const openTasks = openPayload.tasks || [];
    const latestActiveTask = activeTasks[0] || null;

    if (normalizedQuery === 'find tasks') {
      const topOpen = openTasks.slice(0, 5);
      const lines = topOpen.map((task, index) => {
        const severity = task.severity || 'Unknown severity';
        const category = task.category || 'General';
        return `${index + 1}. ${task.title || 'Untitled mission'} | ${category} | ${severity} | ${getTaskLocation(task)}`;
      });

      return {
        title: 'Available Missions',
        reply: topOpen.length > 0
          ? `${openPayload.summary}\n${lines.join('\n')}`
          : openPayload.summary,
        suggestions: buildVolunteerSuggestions([
          topOpen[0] ? `Open ${topOpen[0].title || 'top mission'} first` : null,
          'Ask for Directions',
          'Check Availability',
          'Show My Tasks',
        ]),
      };
    }

    if (normalizedQuery === 'my tasks') {
      const lines = activeTasks.slice(0, 5).map((task, index) => {
        const status = String(task.missionStatus || task.status || 'assigned').replace('_', ' ');
        return `${index + 1}. ${task.title || 'Untitled mission'} | ${status} | ${getTaskLocation(task)}`;
      });

      return {
        title: 'My Active Tasks',
        reply: activeTasks.length > 0
          ? `${tasksPayload.summary}\n${lines.join('\n')}`
          : tasksPayload.summary,
        suggestions: buildVolunteerSuggestions([
          latestActiveTask ? 'Ask for Directions' : 'Find Tasks',
          latestActiveTask ? 'Update Availability' : null,
          'Show My History',
          'Check Done Task',
        ]),
      };
    }

    if (normalizedQuery === 'done task') {
      const completedTasks = allTasks.filter((task) =>
        ['completed', 'resolved'].includes(String(task.status || '').toLowerCase()) ||
        ['completed', 'resolved'].includes(String(task.missionStatus || '').toLowerCase())
      );
      const latestCompleted = completedTasks[0] || null;

      return {
        title: 'Task Completion Status',
        reply: latestCompleted
          ? `Your latest completed mission is ${latestCompleted.title || 'Untitled mission'} at ${getTaskLocation(latestCompleted)}.`
          : activeTasks[0]
            ? `Your current mission ${activeTasks[0].title || 'Untitled mission'} is not completed yet. Current status is ${String(activeTasks[0].missionStatus || activeTasks[0].status || 'assigned').replace('_', ' ')}.`
            : 'You do not have a completed mission to review right now.',
        suggestions: buildVolunteerSuggestions([
          latestActiveTask ? 'Show My Tasks' : 'Find Tasks',
          'Show My History',
          latestActiveTask ? 'Ask for Directions' : null,
        ]),
      };
    }

    if (normalizedQuery === 'availability' || normalizedQuery === 'check availability') {
      const volunteerSnapshot = volunteerId ? await getVolunteers(100) : [];
      const volunteer = volunteerSnapshot.find((entry) => entry.id === volunteerId) || null;
      const status = volunteer?.status || (activeTasks.length > 0 ? 'on_task' : 'available');
      const isAvailable = volunteer?.isAvailable !== false && activeTasks.length === 0;
      const location = volunteer?.location?.address || volunteer?.location?.area || 'coverage location unavailable';

      return {
        title: 'Availability Status',
        reply:
          `Current availability: ${isAvailable ? 'Available' : 'Busy / Unavailable'}.\n` +
          `Operational status: ${status}.\n` +
          `Coverage location: ${location}.\n` +
          `Active task count: ${activeTasks.length}.`,
        suggestions: buildVolunteerSuggestions([
          activeTasks.length > 0 ? 'Show My Tasks' : 'Find Tasks',
          'Ask for Directions',
          'Show My History',
        ]),
      };
    }

    if (normalizedQuery === 'directions' || normalizedQuery === 'ask for directions') {
      return {
        title: 'Directions',
        reply: latestActiveTask
          ? `Primary destination: ${getTaskLocation(latestActiveTask)}.\nMission: ${latestActiveTask.title || 'Untitled mission'}.\nRecommended next step: open the task detail page and start navigation from the in-app map.`
          : 'You do not have an active mission destination right now. Claim a task first to get route guidance.',
        suggestions: buildVolunteerSuggestions([
          latestActiveTask ? 'Show My Tasks' : 'Find Tasks',
          latestActiveTask ? 'Check Availability' : null,
          'Backup Policy',
        ]),
      };
    }

    if (normalizedQuery === 'my history') {
      const completedTasks = allTasks.filter((task) =>
        ['completed', 'resolved'].includes(String(task.status || '').toLowerCase()) ||
        ['completed', 'resolved'].includes(String(task.missionStatus || '').toLowerCase())
      );
      const lines = completedTasks.slice(0, 5).map((task, index) => {
        return `${index + 1}. ${task.title || 'Untitled mission'} | ${getTaskLocation(task)}`;
      });

      return {
        title: 'Mission History',
        reply: completedTasks.length > 0
          ? `You have completed ${completedTasks.length} mission${completedTasks.length > 1 ? 's' : ''}.\n${lines.join('\n')}`
          : 'You do not have completed mission history yet.',
        suggestions: buildVolunteerSuggestions([
          activeTasks.length > 0 ? 'Show My Tasks' : 'Find Tasks',
          'Check Availability',
          'Done Task',
        ]),
      };
    }

    return {
      title: 'Volunteer Operations',
      reply: 'Try one of these commands: Find Tasks, My Tasks, Done Task, Availability, Directions, My History.',
      suggestions: ['Find Tasks', 'My Tasks', 'Availability', 'My History'],
    };
  },

  async generateRoleCopilotReply({ role = 'user', message, userData = {}, context = {} }) {
    const deterministic = await buildDeterministicCopilotReply(this, role, message, userData, context);
    if (deterministic) {
      return {
        ...deterministic,
        role,
      };
    }

    const fallbackReply = buildFallbackRoleReply(role, message, context);
    const structured = await requestStructuredJson(
      `${ROLE_SYSTEM_PROMPTS[role] || ROLE_SYSTEM_PROMPTS.user}
Return JSON with keys: reply, nextActions, riskFlags, suggestedTools.`,
      {
        role,
        message,
        userData,
        context,
      },
      {
        reply: fallbackReply,
        nextActions: [],
        riskFlags: [],
        suggestedTools: [],
      }
    );

    return {
      reply: structured.reply || fallbackReply,
      nextActions: structured.nextActions || [],
      riskFlags: structured.riskFlags || [],
      suggestedTools: structured.suggestedTools || [],
      role,
    };
  },

  async getCommandCenterBrief() {
    const [incidents, volunteers, notifications] = await Promise.all([
      getRecentIncidents(50),
      getVolunteers(50),
      getNotifications(50),
    ]);

    const hotspots = await this.analyzeHotspots({ incidents, volunteers });
    const resourcePlan = await this.optimizeResources({ incidents, volunteers, hotspots: hotspots.hotspots });
    const criticalOpen = incidents.filter(
      (incident) =>
        String(incident.severity || '').toLowerCase() === 'critical' &&
        !['resolved', 'closed', 'completed'].includes(String(incident.status || '').toLowerCase())
    ).length;
    const unreadAlerts = notifications.filter((notification) => notification.isRead !== true && notification.read !== true).length;

    return {
      overview: {
        activeIncidents: incidents.filter((incident) => !['resolved', 'closed', 'completed'].includes(String(incident.status || '').toLowerCase())).length,
        criticalOpen,
        availableVolunteers: volunteers.filter((volunteer) => volunteer.isAvailable !== false && volunteer.status !== 'offline').length,
        unreadAlerts,
      },
      hotspots: hotspots.hotspots,
      underservedAreas: hotspots.underservedAreas,
      resourcePlan,
      strategicRecommendations: [
        hotspots.forecast,
        resourcePlan.shortagePrediction,
        resourcePlan.prepositioningAdvice,
      ].filter(Boolean),
    };
  },

  getHealth() {
    const vertexStatus = getVertexConfigStatus();
    return {
      status: vertexStatus.projectMatch ? 'operational' : 'degraded',
      service: 'Vertex Intelligence Layer',
      configuredProjectId: vertexStatus.configuredProjectId ? 'Configured' : 'Missing',
      credentialProjectId: vertexStatus.credentialProjectId || 'Missing',
      projectMatch: vertexStatus.projectMatch,
      credentialsPath: vertexStatus.credentialsPath,
      modules: [
        'incident-triage',
        'volunteer-matching',
        'backup-escalation',
        'hotspot-intelligence',
        'resource-optimization',
        'trust-and-safety',
        'applicant-screening',
        'role-copilots',
      ],
    };
  },
};
