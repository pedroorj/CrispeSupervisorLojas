'use strict';

// Server-Sent Events realtime service.
// Clients connect via GET /api/events and receive live updates.

const clients = new Map(); // userId -> Set<res>

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  }
}

function sendToUser(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

function broadcast(event, data) {
  for (const [userId] of clients) {
    sendToUser(userId, event, data);
  }
}

module.exports = { addClient, removeClient, sendToUser, broadcast };
