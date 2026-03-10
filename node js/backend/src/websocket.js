/**
 * WebSocket signaling server for WebRTC + real-time chat.
 *
 * Message types:
 *   join-room      – user joins a room
 *   leave-room     – user leaves a room
 *   offer          – SDP offer (from initiator)
 *   answer         – SDP answer (from responder)
 *   ice-candidate  – ICE candidate exchange
 *   chat-message   – text message in room
 *   user-toggle    – mute/unmute/video toggle notification
 *   screen-share   – screen share started/stopped
 */
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getDB } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

// In-memory room state: roomId -> Map<peerId, { ws, user, hasVideo, hasAudio }>
const rooms = new Map();

/**
 * Attach WebSocket server to an existing HTTP server.
 */
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let currentUser = null;
    let currentRoom = null;
    let peerId = null;

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        // ─── Authentication & Room Join ─────────────────────────────────
        case 'join-room': {
          // Verify token
          try {
            const decoded = jwt.verify(msg.token, JWT_SECRET);
            currentUser = decoded;
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            return;
          }

          currentRoom = msg.roomId;
          peerId = `${currentUser.id}-${Date.now()}`;

          // Ensure room map exists
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Map());
          }

          const room = rooms.get(currentRoom);

          // Notify existing peers about new participant
          const existingPeers = [];
          for (const [pid, peer] of room) {
            existingPeers.push({
              peerId: pid,
              user: peer.user,
              hasVideo: peer.hasVideo,
              hasAudio: peer.hasAudio,
            });
            // Tell existing peer about the new joiner
            safeSend(peer.ws, {
              type: 'user-joined',
              peerId,
              user: {
                id: currentUser.id,
                displayName: currentUser.displayName,
                avatarColor: currentUser.avatarColor || '#4A90D9',
              },
            });
          }

          // Add self to room
          room.set(peerId, {
            ws,
            user: {
              id: currentUser.id,
              displayName: currentUser.displayName,
              avatarColor: currentUser.avatarColor || '#4A90D9',
            },
            hasVideo: false,
            hasAudio: false,
          });

          // Send back own peerId + list of existing peers
          ws.send(JSON.stringify({
            type: 'room-joined',
            peerId,
            peers: existingPeers,
          }));

          console.log(`[WS] ${currentUser.displayName} joined room ${currentRoom} as ${peerId}`);
          break;
        }

        // ─── WebRTC Signaling ────────────────────────────────────────────
        case 'offer': {
          const target = findPeer(currentRoom, msg.targetPeerId);
          if (target) {
            safeSend(target.ws, {
              type: 'offer',
              offer: msg.offer,
              fromPeerId: peerId,
              user: rooms.get(currentRoom)?.get(peerId)?.user,
            });
          }
          break;
        }

        case 'answer': {
          const target = findPeer(currentRoom, msg.targetPeerId);
          if (target) {
            safeSend(target.ws, {
              type: 'answer',
              answer: msg.answer,
              fromPeerId: peerId,
            });
          }
          break;
        }

        case 'ice-candidate': {
          const target = findPeer(currentRoom, msg.targetPeerId);
          if (target) {
            safeSend(target.ws, {
              type: 'ice-candidate',
              candidate: msg.candidate,
              fromPeerId: peerId,
            });
          }
          break;
        }

        // ─── Media state toggles ─────────────────────────────────────────
        case 'user-toggle': {
          // Update in-memory state
          const room = rooms.get(currentRoom);
          if (room && room.has(peerId)) {
            const me = room.get(peerId);
            if (msg.kind === 'video') me.hasVideo = msg.enabled;
            if (msg.kind === 'audio') me.hasAudio = msg.enabled;
          }
          // Broadcast to others in room
          broadcastToRoom(currentRoom, peerId, {
            type: 'user-toggle',
            peerId,
            kind: msg.kind,
            enabled: msg.enabled,
          });
          break;
        }

        // ─── Screen sharing notification ─────────────────────────────────
        case 'screen-share': {
          broadcastToRoom(currentRoom, peerId, {
            type: 'screen-share',
            peerId,
            active: msg.active,
          });
          break;
        }

        // ─── Chat Messages ──────────────────────────────────────────────
        case 'chat-message': {
          if (!currentRoom || !currentUser) return;

          // Persist to DB
          try {
            const db = getDB();
            db.prepare('INSERT INTO messages (roomId, userId, content) VALUES (?, ?, ?)').run(
              currentRoom,
              currentUser.id,
              msg.content
            );
          } catch (e) {
            console.error('Chat DB error:', e);
          }

          // Broadcast to ALL in room (including sender for confirmation)
          const room = rooms.get(currentRoom);
          if (room) {
            const chatMsg = {
              type: 'chat-message',
              peerId,
              user: rooms.get(currentRoom)?.get(peerId)?.user,
              content: msg.content,
              timestamp: new Date().toISOString(),
            };
            for (const [, peer] of room) {
              safeSend(peer.ws, chatMsg);
            }
          }
          break;
        }

        // ─── Leave Room ──────────────────────────────────────────────────
        case 'leave-room': {
          handleLeave();
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      handleLeave();
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      handleLeave();
    });

    function handleLeave() {
      if (!currentRoom || !peerId) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.delete(peerId);
        // Notify remaining peers
        for (const [, peer] of room) {
          safeSend(peer.ws, { type: 'user-left', peerId });
        }
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(currentRoom);
        }
      }
      console.log(`[WS] ${currentUser?.displayName || 'Unknown'} left room ${currentRoom}`);
      currentRoom = null;
      peerId = null;
    }
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('[WS] WebSocket signaling server ready');
  return wss;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findPeer(roomId, targetPeerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return room.get(targetPeerId) || null;
}

function broadcastToRoom(roomId, excludePeerId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [pid, peer] of room) {
    if (pid !== excludePeerId) {
      safeSend(peer.ws, message);
    }
  }
}

function safeSend(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

module.exports = { setupWebSocket };
