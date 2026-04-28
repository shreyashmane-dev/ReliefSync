import { vertexIntelligenceService } from "../services/vertexIntelligenceService.js";

/**
 * Controller for general disaster report analysis (Requirement #4)
 * POST /api/analyze-report
 */
export async function analyzeGenericReport(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Report text is required" });
    }

    const result = await vertexIntelligenceService.triageIncident({
      title: 'Mission report',
      description: text,
      message: text,
    });
    res.json(result);
  } catch (error) {
    console.error("AI Generic Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze mission report" });
  }
}

/**
 * Legacy/Specialized Analysis Controller
 */
export async function analyzeReport(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const triage = await vertexIntelligenceService.triageIncident({
      title: 'Community report',
      description: message,
      message,
    });

    res.json({
      urgency: triage.severity,
      emergency_type: triage.category.toLowerCase(),
      volunteers_needed: triage.resourceEstimate.volunteers,
      actions: triage.recommendedActions.join(' '),
      location_summary: 'Confirmed report location',
      intelligence: triage,
    });
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
}
