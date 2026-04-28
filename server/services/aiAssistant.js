import dotenv from 'dotenv';
import { SessionsClient } from '@google-cloud/dialogflow-cx';
import { getVertexConfigStatus, resolveVertexCredentials } from '../config/vertex.js';

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const agentId = process.env.VERTEX_AGENT_ID;
const location = process.env.VERTEX_LOCATION;
const vertexCredentials = resolveVertexCredentials();
const vertexStatus = getVertexConfigStatus();

// Setup client connection to Google
const client = new SessionsClient({
    apiEndpoint: 'us-central1-dialogflow.googleapis.com',
    ...(vertexCredentials?.path ? { keyFilename: vertexCredentials.path } : {})
});

if (!vertexStatus.projectMatch) {
    console.warn(
        `Vertex config mismatch: GOOGLE_CLOUD_PROJECT_ID=${vertexStatus.configuredProjectId || 'missing'} ` +
        `but credential project is ${vertexStatus.credentialProjectId || 'missing'} ` +
        `from ${vertexStatus.credentialsPath || 'no credential file found'}.`
    );
}

// Store user sessions
const activeSessions = {};

// ================================================
// MAIN FUNCTION - Talk to Vertex AI
// ================================================
export async function sendMessageToAI(userMessage, userId, userRole, userData) {
    try {
        // Create session if new user
        if (!activeSessions[userId]) {
            activeSessions[userId] = `session_${userId}_${Date.now()}`;
        }

        const sessionId = activeSessions[userId];

        // Build the session path
        const sessionPath = client.projectLocationAgentSessionPath(
            projectId,
            location,
            agentId,
            sessionId
        );

        // Add role context to message
        const contextMessage = addRoleContext(userMessage, userRole, userData);

        // Build request to send to Vertex AI
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: contextMessage,
                },
                languageCode: 'en',
            },
        };

        // Send to Vertex AI and get response
        const [response] = await client.detectIntent(request);

        // Extract the text response
        let botReply = '';
        const responseMessages = response.queryResult.responseMessages;

        responseMessages.forEach(msg => {
            if (msg.text && msg.text.text) {
                botReply += msg.text.text.join(' ');
            }
        });

        // If no response, give default
        if (!botReply) {
            botReply = getDefaultResponse(userRole);
        }

        return {
            success: true,
            reply: botReply,
            intent: response.queryResult.match?.intent?.displayName || 'general',
            userRole: userRole
        };

    } catch (error) {
        console.error('Vertex AI Error:', error.message);
        return {
            success: false,
            reply: 'I am having trouble right now. Please try again in a moment.',
            error: error.message
        };
    }
}

// ================================================
// ADD ROLE CONTEXT TO MESSAGE
// ================================================
function addRoleContext(message, userRole, userData) {
    const contexts = {
        admin: `[ADMIN: ${userData?.name || 'Admin'}] ${message}`,
        volunteer: `[VOLUNTEER: ${userData?.name || 'Volunteer'}, Skills: ${userData?.skills?.join(', ') || 'Not specified'}] ${message}`,
        user: `[COMMUNITY MEMBER: ${userData?.name || 'User'}, Area: ${userData?.area || 'Not specified'}] ${message}`
    };

    return contexts[userRole] || `[USER] ${message}`;
}

// ================================================
// DEFAULT RESPONSES BY ROLE
// ================================================
function getDefaultResponse(userRole) {
    const defaults = {
        admin: 'I can help you manage resources and volunteers. What would you like to do?',
        volunteer: 'I can help you find tasks and manage your assignments. What do you need?',
        user: 'I can help you report needs or check status. How can I assist you?'
    };
    return defaults[userRole] || 'How can I help you today?';
}

// ================================================
// RESET USER SESSION
// ================================================
export function resetSession(userId) {
    if (activeSessions[userId]) {
        delete activeSessions[userId];
        return true;
    }
    return false;
}

export function getVertexHealth() {
    return {
        status: vertexStatus.projectMatch ? 'operational' : 'degraded',
        service: 'Vertex AI Assistant',
        configuredProjectId: vertexStatus.configuredProjectId ? 'Configured' : 'Missing',
        credentialProjectId: vertexStatus.credentialProjectId || 'Missing',
        projectMatch: vertexStatus.projectMatch,
        credentialsPath: vertexStatus.credentialsPath,
    };
}
