import express from "express";
import { analyzeReport, analyzeGenericReport } from "../controllers/aiController.js";
import { vertexIntelligenceService } from "../services/vertexIntelligenceService.js";

const router = express.Router();

router.post("/ai-analyze", analyzeReport);
router.post("/analyze-report", analyzeGenericReport);

// ================================================
// TASK 2 - VERTEX AI ENDPOINTS
// ================================================

// 1. CHAT ENDPOINT
router.post("/chat", async (req, res) => {
    const { message, userId, userRole, userData } = req.body;
    
    if (!message || !userId) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const response = await vertexIntelligenceService.generateRoleCopilotReply({
        role: userRole || 'user',
        message,
        userData: {
            id: userId,
            ...userData,
        },
        context: req.body?.context || {},
    });
    res.status(200).json({
        success: true,
        reply: response.reply,
        role: response.role,
        nextActions: response.nextActions,
        riskFlags: response.riskFlags,
        suggestedTools: response.suggestedTools,
    });
});

// 2. RESET ENDPOINT
router.post("/reset", (req, res) => {
    res.json({ success: true, message: "Stateless intelligence session reset." });
});

// 3. HEALTH ENDPOINT
router.get("/health", (req, res) => {
    const health = vertexIntelligenceService.getHealth();
    res.status(health.projectMatch ? 200 : 503).json(health);
});

router.post("/intelligence/triage", async (req, res) => {
    const incident = req.body?.incident || req.body;
    if (!incident) {
        return res.status(400).json({ error: "incident is required" });
    }

    const result = await vertexIntelligenceService.triageIncident(incident, {
        history: req.body?.history,
    });
    res.json(result);
});

router.post("/intelligence/match", async (req, res) => {
    const { incident, volunteers = [], currentAssignments = [] } = req.body ?? {};
    if (!incident) {
        return res.status(400).json({ error: "incident is required" });
    }

    const result = await vertexIntelligenceService.matchVolunteers(incident, volunteers, {
        currentAssignments,
    });
    res.json(result);
});

router.post("/intelligence/escalation", async (req, res) => {
    const { incident, assignedResponders = [], candidateResponders = [] } = req.body ?? {};
    if (!incident) {
        return res.status(400).json({ error: "incident is required" });
    }

    const result = await vertexIntelligenceService.evaluateEscalation(
        incident,
        assignedResponders,
        candidateResponders
    );
    res.json(result);
});

router.post("/intelligence/hotspots", async (req, res) => {
    const result = await vertexIntelligenceService.analyzeHotspots(req.body || {});
    res.json(result);
});

router.post("/intelligence/resources", async (req, res) => {
    const result = await vertexIntelligenceService.optimizeResources(req.body || {});
    res.json(result);
});

router.post("/intelligence/trust", async (req, res) => {
    const { report, context = {} } = req.body ?? {};
    if (!report) {
        return res.status(400).json({ error: "report is required" });
    }

    const result = await vertexIntelligenceService.assessTrustSafety(report, context);
    res.json(result);
});

router.post("/intelligence/screen-volunteer", async (req, res) => {
    const applicant = req.body?.applicant || req.body;
    if (!applicant) {
        return res.status(400).json({ error: "applicant is required" });
    }

    const result = await vertexIntelligenceService.screenVolunteerApplicant(applicant);
    res.json(result);
});

router.get("/intelligence/command-center", async (_req, res) => {
    const result = await vertexIntelligenceService.getCommandCenterBrief();
    res.json(result);
});

router.get("/intelligence/volunteer-tasks/:volunteerId", async (req, res) => {
    const { volunteerId } = req.params;
    if (!volunteerId) {
        return res.status(400).json({ error: "volunteerId is required" });
    }

    const result = await vertexIntelligenceService.listVolunteerTasks(volunteerId);
    res.json(result);
});

router.get("/intelligence/open-tasks", async (_req, res) => {
    const result = await vertexIntelligenceService.listOpenTasks();
    res.json(result);
});

router.post("/intelligence/volunteer-ops", async (req, res) => {
    const { volunteerId, query } = req.body ?? {};
    if (!volunteerId || !query) {
        return res.status(400).json({ error: "volunteerId and query are required" });
    }

    const result = await vertexIntelligenceService.handleVolunteerOperationsQuery({
        volunteerId,
        query,
    });
    res.json(result);
});

export default router;
