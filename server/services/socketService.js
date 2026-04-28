import { Server } from 'socket.io';
import { db } from '../config/firebase-admin.js';

const connectedUsers = new Map();
let ioInstance = null;

const safeVolunteerOfflineUpdate = async (userId) => {
  try {
    await db.collection('volunteers').doc(userId).set(
      {
        status: 'offline',
        lastSeenAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Failed to mark volunteer offline:', error.message);
  }
};

export const initializeSocket = (httpServer) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.CLIENT_ORIGIN,
      ].filter(Boolean),
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('user_connected', async ({ userId, userRole }) => {
      if (!userId) return;

      connectedUsers.set(userId, {
        socketId: socket.id,
        userRole: userRole || 'user',
      });

      socket.data.userId = userId;
      socket.data.userRole = userRole || 'user';
      socket.join(`user:${userId}`);

      if (userRole === 'volunteer') {
        try {
          await db.collection('volunteers').doc(userId).set(
            {
              status: 'available',
              isAvailable: true,
              lastSeenAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (error) {
          console.warn('Failed to mark volunteer available on connect:', error.message);
        }
      }

      socket.emit('connection_confirmed', {
        userId,
        socketId: socket.id,
      });
    });

    socket.on('volunteer_response', async (payload) => {
      try {
        const { handleVolunteerResponse } = await import('./notificationService.js');
        const result = await handleVolunteerResponse(payload);
        socket.emit('volunteer_response_result', {
          success: true,
          ...result,
        });
      } catch (error) {
        console.error('volunteer_response failed:', error);
        socket.emit('volunteer_response_result', {
          success: false,
          error: error.message || 'Unable to process volunteer response.',
        });
      }
    });

    socket.on('task_status_update', async (payload) => {
      try {
        const { handleTaskStatusUpdate } = await import('./notificationService.js');
        const result = await handleTaskStatusUpdate(payload);
        socket.emit('task_status_update_result', {
          success: true,
          ...result,
        });
      } catch (error) {
        console.error('task_status_update failed:', error);
        socket.emit('task_status_update_result', {
          success: false,
          error: error.message || 'Unable to update task status.',
        });
      }
    });

    socket.on('disconnect', async () => {
      const disconnectedUserId = socket.data.userId;
      const disconnectedUserRole = socket.data.userRole;

      if (disconnectedUserId) {
        connectedUsers.delete(disconnectedUserId);
      }

      if (disconnectedUserId && disconnectedUserRole === 'volunteer') {
        await safeVolunteerOfflineUpdate(disconnectedUserId);
      }
    });
  });

  return ioInstance;
};

export const getIO = () => ioInstance;

export const getSocketId = (userId) => connectedUsers.get(userId)?.socketId || null;

export const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return false;

  const socketId = getSocketId(userId);
  if (socketId) {
    ioInstance.to(socketId).emit(eventName, payload);
  }

  ioInstance.to(`user:${userId}`).emit(eventName, payload);
  return Boolean(socketId);
};
