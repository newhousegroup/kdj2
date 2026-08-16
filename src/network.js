(() => {
  const MAX_USERS = 6;
  const ROOM_PREFIX = "kdj2-room-";
  const COLORS = [
    { name: "Coral", key: "0", hex: "#ef7468" },
    { name: "Peach", key: "1", hex: "#f1aa77" },
    { name: "Yellow", key: "2", hex: "#dfc451" },
    { name: "Turquoise", key: "3", hex: "#55b8b1" },
    { name: "Blue", key: "4", hex: "#6488cf" },
    { name: "Purple", key: "5", hex: "#8a6bc0" }
  ];

  class KDJNetwork {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.peer = null;
      this.hostConnection = null;
      this.guests = new Map();
      this.pendingGuests = new Map();
      this.isHost = false;
      this.selfId = null;
      this.roomCode = [];
      this.iceServers = null;
      this.iceExpiresAt = 0;
      this.attemptToken = 0;
    }

    static get colors() { return COLORS; }
    static codeToPeerId(code) { return `${ROOM_PREFIX}${code.join("")}`; }
    static randomCode() { return Array.from({ length: 4 }, () => COLORS[Math.floor(Math.random() * COLORS.length)].key); }

    status(text, kind = "ready") { this.callbacks.onStatus?.(text, kind); }

    async loadTurn() {
      if (this.iceServers && Date.now() < this.iceExpiresAt - 60000) return this.iceServers;
      const response = await fetch("/api/turn-credentials", { cache: "no-store", headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.iceServers)) {
        const missing = payload?.missing?.length ? ` Missing: ${payload.missing.join(", ")}.` : "";
        throw new Error(`TURN relay unavailable.${missing}`);
      }
      this.iceServers = payload.iceServers;
      this.iceExpiresAt = Number(payload.expiresAt) || Date.now() + 3600000;
      return this.iceServers;
    }

    peerOptions() {
      return {
        host: "0.peerjs.com",
        port: 443,
        path: "/",
        secure: true,
        debug: 1,
        config: {
          iceServers: this.iceServers || [],
          iceTransportPolicy: "all",
          iceCandidatePoolSize: 4
        }
      };
    }

    async prepare() {
      this.status("Preparing relay…", "ready");
      await this.loadTurn();
    }

    cleanup() {
      this.attemptToken += 1;
      for (const conn of this.guests.values()) { try { conn.close(); } catch (_) {} }
      for (const conn of this.pendingGuests.values()) { try { conn.close(); } catch (_) {} }
      this.guests.clear();
      this.pendingGuests.clear();
      if (this.hostConnection) { try { this.hostConnection.close(); } catch (_) {} }
      this.hostConnection = null;
      if (this.peer) { try { this.peer.destroy(); } catch (_) {} }
      this.peer = null;
      this.selfId = null;
      this.isHost = false;
      this.roomCode = [];
    }

    async createRoom(name) {
      await this.prepare();
      this.cleanup();
      this.isHost = true;
      const token = ++this.attemptToken;
      this.status("Creating battle…", "ready");

      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (token !== this.attemptToken) return null;
        const code = KDJNetwork.randomCode();
        try {
          const id = await this.openHostPeer(code, token);
          this.roomCode = code;
          this.selfId = id;
          this.status("Battle ready", "ready");
          return { id, code, name };
        } catch (error) {
          if (error?.type !== "unavailable-id") throw error;
        }
      }
      throw new Error("Could not allocate a room code.");
    }

    openHostPeer(code, token) {
      return new Promise((resolve, reject) => {
        const requestedId = KDJNetwork.codeToPeerId(code);
        const peer = new Peer(requestedId, this.peerOptions());
        this.peer = peer;
        let settled = false;

        peer.on("open", (id) => {
          if (token !== this.attemptToken) return;
          settled = true;
          this.installHostPeerHandlers(peer);
          resolve(id);
        });

        peer.on("error", (error) => {
          if (settled || token !== this.attemptToken) {
            if (error?.type !== "unavailable-id") this.callbacks.onError?.(error);
            return;
          }
          try { peer.destroy(); } catch (_) {}
          reject(error);
        });
      });
    }

    installHostPeerHandlers(peer) {
      peer.on("connection", (conn) => this.handleIncomingConnection(conn));
      peer.on("disconnected", () => {
        this.status("Signaling reconnecting", "ready");
        if (!peer.destroyed) { try { peer.reconnect(); } catch (_) {} }
      });
      peer.on("error", (error) => this.callbacks.onError?.(error));
    }

    handleIncomingConnection(conn) {
      this.pendingGuests.set(conn.peer, conn);
      this.watchRoute(conn);
      conn.on("data", (data) => {
        if (!data || typeof data !== "object") return;
        if (data.type === "join") {
          if (this.guests.size >= MAX_USERS - 1) {
            conn.send({ type: "reject", reason: "Battle is full (6 / 6)." });
            setTimeout(() => conn.close(), 120);
            return;
          }
          this.callbacks.onJoinRequest?.({ peerId: conn.peer, name: String(data.name || "Sailor").slice(0, 20) });
          return;
        }
        if (this.guests.has(conn.peer)) this.callbacks.onPacket?.(conn.peer, data);
      });
      conn.on("close", () => this.dropGuest(conn.peer));
      conn.on("error", () => this.dropGuest(conn.peer));
    }

    acceptGuest(peerId, payload) {
      const conn = this.pendingGuests.get(peerId);
      if (!conn?.open) return false;
      this.pendingGuests.delete(peerId);
      this.guests.set(peerId, conn);
      conn.send({ type: "welcome", ...payload });
      this.callbacks.onGuestAccepted?.(peerId);
      return true;
    }

    rejectGuest(peerId, reason) {
      const conn = this.pendingGuests.get(peerId);
      if (!conn) return;
      try { conn.send({ type: "reject", reason }); } catch (_) {}
      setTimeout(() => { try { conn.close(); } catch (_) {} }, 100);
      this.pendingGuests.delete(peerId);
    }

    dropGuest(peerId) {
      const existed = this.guests.delete(peerId) || this.pendingGuests.delete(peerId);
      if (existed) this.callbacks.onGuestLeft?.(peerId);
    }

    async joinRoom(name, code) {
      await this.prepare();
      this.cleanup();
      this.isHost = false;
      this.roomCode = [...code];
      const token = ++this.attemptToken;
      const targetId = KDJNetwork.codeToPeerId(code);
      const started = Date.now();
      this.status("Finding battle…", "ready");

      while (Date.now() - started < 18000 && token === this.attemptToken) {
        try {
          return await this.tryGuestConnection(name, targetId, token);
        } catch (error) {
          if (error?.fatal) throw error;
          this.status(error?.found ? "Battle found, retrying connection…" : "Still looking…", "ready");
          await new Promise((resolve) => setTimeout(resolve, 850));
        }
      }
      throw new Error("No battle was found with that color code.");
    }

    tryGuestConnection(name, targetId, token) {
      return new Promise((resolve, reject) => {
        if (token !== this.attemptToken) return reject({ fatal: true, message: "Cancelled" });
        const peer = new Peer(this.peerOptions());
        this.peer = peer;
        let found = false;
        let done = false;
        const timeout = setTimeout(() => finishReject({ found }), 5600);

        const finishReject = (info = {}) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          try { peer.destroy(); } catch (_) {}
          if (this.peer === peer) this.peer = null;
          reject(info);
        };

        peer.on("open", (id) => {
          if (token !== this.attemptToken) return finishReject({ fatal: true });
          this.selfId = id;
          const conn = peer.connect(targetId, { reliable: true, serialization: "json", metadata: { app: "kdj2", version: window.KDJ_VERSION || "0.1.0" } });
          this.hostConnection = conn;
          this.watchRoute(conn);

          conn.on("open", () => {
            found = true;
            this.status("Joining battle…", "ready");
            conn.send({ type: "join", name });
          });

          conn.on("data", (data) => {
            if (done || !data || typeof data !== "object") return;
            if (data.type === "reject") {
              done = true;
              clearTimeout(timeout);
              reject({ fatal: true, message: data.reason || "Could not join battle." });
              return;
            }
            if (data.type === "welcome") {
              done = true;
              clearTimeout(timeout);
              this.installGuestSteadyState(conn);
              resolve({ id, ...data });
              return;
            }
          });
        });

        peer.on("error", (error) => {
          if (done) return;
          if (error?.type === "peer-unavailable") return finishReject({ found: false });
          if (["webrtc", "network", "socket-error", "socket-closed"].includes(error?.type)) return finishReject({ found });
          finishReject({ fatal: true, message: error?.message || "Connection failed." });
        });
      });
    }

    installGuestSteadyState(conn) {
      conn.on("data", (data) => {
        if (!data || typeof data !== "object" || data.type === "welcome") return;
        this.callbacks.onPacket?.("host", data);
      });
      conn.on("close", () => this.callbacks.onHostLeft?.());
      conn.on("error", () => this.callbacks.onHostLeft?.());
    }

    send(packet) {
      if (this.isHost) return this.callbacks.onPacket?.(this.selfId, packet);
      if (this.hostConnection?.open) this.hostConnection.send(packet);
    }

    sendTo(peerId, packet) {
      const conn = this.guests.get(peerId);
      if (conn?.open) conn.send(packet);
    }

    broadcast(packet, exceptId = null) {
      if (!this.isHost) return;
      for (const [peerId, conn] of this.guests.entries()) {
        if (peerId === exceptId || !conn.open) continue;
        try { conn.send(packet); } catch (_) {}
      }
    }

    count() { return 1 + this.guests.size; }

    async watchRoute(conn) {
      const pc = conn?.peerConnection;
      if (!pc) return;
      const update = async () => {
        if (!["connected", "completed"].includes(pc.iceConnectionState)) return;
        try {
          const stats = await pc.getStats();
          let pair = null;
          stats.forEach((r) => { if (!pair && r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
          if (!pair) stats.forEach((r) => { if (!pair && r.type === "candidate-pair" && r.state === "succeeded" && (r.selected || r.nominated)) pair = r; });
          const local = pair?.localCandidateId ? stats.get(pair.localCandidateId) : null;
          const remote = pair?.remoteCandidateId ? stats.get(pair.remoteCandidateId) : null;
          const relay = local?.candidateType === "relay" || remote?.candidateType === "relay";
          this.status(relay ? "TURN relay" : "Direct connection", relay ? "turn" : "direct");
        } catch (_) { this.status("Connected", "ready"); }
      };
      pc.addEventListener?.("iceconnectionstatechange", () => {
        if (pc.iceConnectionState === "failed") this.status("Connection failure", "failure");
        else update();
      });
    }
  }

  window.KDJNetwork = KDJNetwork;
})();
