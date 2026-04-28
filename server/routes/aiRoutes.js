import express from "express";
import { analyzeReport, analyzeGenericReport } from "../controllers/aiController.js";
import { getVertexHealth, sendMessageToAI, resetSession } from "../services/aiAssistant.js";

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

    const response = await sendMessageToAI(message, userId, userRole, userData);
    res.status(response.success ? 200 : 503).json(response);
});

// 2. RESET ENDPOINT
router.post("/reset", (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ success: false, message: "Missing userId." });
    }

    const success = resetSession(userId);
    res.json({ success, message: success ? "Session reset." : "No active session found." });
});

// 3. HEALTH ENDPOINT
router.get("/health", (req, res) => {
    const health = getVertexHealth();
    res.status(health.projectMatch ? 200 : 503).json(health);
});

export default router;
