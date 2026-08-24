(() => {
  const BOT_ID = "kdj2-local-bot";
  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const previousCreateRoom = Network.prototype.createRoom;
  const previousCleanup = Network.prototype.cleanup;

  function makeEasyState() {
    return {
      nextNavAt: 0,
      nav: { w: false, s: false, a: false, d: false },
      nextHesitationAt: Date.now() + 1800 + Math.random() * 1800,
      hesitationUntil: 0,
      seenSwordSeq: 0,
      acceptedSwordSeq: 0,
      swordAttempts: 0,
      seenFireSeq: 0,
      acceptedFireSeq: 0,
      fireAttempts: 0,
      seenGrappleSeq: 0,
      acceptedGrappleSeq: 0,
      grappleAttempts: 0
    };
  }

  function easyInput(state, input) {
    const now = Date.now();
    const next = { ...input };

    // Easy reacts to helm/walking changes less often, so it overshoots a little
    // and takes longer to line up than Medium without changing ship physics.
    if (now >= state.nextNavAt) {
      state.nextNavAt = now + 260;
      state.nav = { w: !!input.w, s: !!input.s, a: !!input.a, d: !!input.d };
    }
    next.w = state.nav.w;
    next.s = state.nav.s;
    next.a = state.nav.a;
    next.d = state.nav.d;

    // Short thinking pauses make Easy visibly less decisive while preserving all
    // station interactions and objective logic.
    if (now >= state.nextHesitationAt) {
      state.hesitationUntil = now + 320 + Math.random() * 300;
      state.nextHesitationAt = now + 2400 + Math.random() * 2200;
    }
    if (now < state.hesitationUntil) {
      next.w = next.s = next.a = next.d = false;
    }

    const swordSeq = Number(input.swordSeq || 0);
    if (swordSeq > state.seenSwordSeq) {
      state.seenSwordSeq = swordSeq;
      state.swordAttempts += 1;
      if (state.swordAttempts % 2 === 0) state.acceptedSwordSeq = swordSeq;
    }
    next.swordSeq = state.acceptedSwordSeq;

    const fireSeq = Number(input.fireSeq || 0);
    if (fireSeq > state.seenFireSeq) {
      state.seenFireSeq = fireSeq;
      state.fireAttempts += 1;
      // Let roughly two of every three cannon opportunities through.
      if (state.fireAttempts % 3 !== 1) state.acceptedFireSeq = fireSeq;
    }
    next.fireSeq = state.acceptedFireSeq;

    const grappleSeq = Number(input.grappleSeq || 0);
    if (grappleSeq > state.seenGrappleSeq) {
      state.seenGrappleSeq = grappleSeq;
      state.grappleAttempts += 1;
      // Occasionally hesitate on a boarding opportunity, forcing another setup.
      if (state.grappleAttempts % 3 !== 1) state.acceptedGrappleSeq = grappleSeq;
    }
    next.grappleSeq = state.acceptedGrappleSeq;

    return next;
  }

  Network.prototype.createRoom = async function createRoom0204Easy(name) {
    const room = await previousCreateRoom.call(this, name);
    if (!this.__kdjSinglePlayer || window.__KDJ_BOT_DIFFICULTY__ !== "easy") return room;

    const originalOnPacket = this.callbacks.onPacket;
    this.__kdj0204EasyOriginalOnPacket = originalOnPacket;
    this.__kdj0204EasyState = makeEasyState();

    this.callbacks.onPacket = (from, packet) => {
      if (from === BOT_ID && packet?.type === "input" && packet.input) {
        const softened = easyInput(this.__kdj0204EasyState, packet.input);
        return originalOnPacket?.(from, { ...packet, input: softened });
      }
      return originalOnPacket?.(from, packet);
    };

    return room;
  };

  Network.prototype.cleanup = function cleanup0204Easy() {
    if (this.__kdj0204EasyOriginalOnPacket) {
      this.callbacks.onPacket = this.__kdj0204EasyOriginalOnPacket;
    }
    this.__kdj0204EasyOriginalOnPacket = null;
    this.__kdj0204EasyState = null;
    return previousCleanup.call(this);
  };
})();
