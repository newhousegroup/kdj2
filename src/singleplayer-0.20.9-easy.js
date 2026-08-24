(() => {
  const BOT_ID = "kdj2-local-bot";
  const THINK_DELAY_MS = 350;
  const CANNON_AIM_ERROR = 7 * Math.PI / 180;
  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const previousCreateRoom = Network.prototype.createRoom;
  const previousCleanup = Network.prototype.cleanup;
  const nativeSetInterval = window.setInterval.bind(window);
  let intervalTarget = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function makeEasyState() {
    return {
      nextThinkAt: 0,
      nextHesitationAt: Date.now() + 2200 + Math.random() * 1800,
      hesitationUntil: 0,
      lastDesiredTurn: 0,
      appliedTurn: 0,
      oversteerUntil: 0,
      seenSwordSeq: 0,
      acceptedSwordSeq: 0,
      lastSwordAt: 0,
      seenFireSeq: 0,
      acceptedFireSeq: 0,
      pendingFireTimer: null,
      seenGrappleSeq: 0,
      acceptedGrappleSeq: 0,
      acceptedInteractSeq: 0,
      targetContext: null,
      lostTargetUntil: 0,
      lastTrim: null,
      forgetCruising: null,
      reefedReactAt: 0
    };
  }

  function isEasy(network) {
    return network.__kdjSinglePlayer && window.__KDJ_BOT_DIFFICULTY__ === "easy";
  }

  function context(network) {
    const ai = network.__kdjBotAi;
    const state = ai?.state;
    const bot = state?.players?.[BOT_ID];
    const ship = bot ? state?.ships?.[bot.team] : null;
    const human = state ? Object.values(state.players || {}).find((p) => p.id !== BOT_ID) || null : null;
    return { ai, state, bot, ship, human };
  }

  function updateAwareness(network, easy, now) {
    const { bot, human } = context(network);
    if (!bot || !human || bot.ship === bot.team) {
      easy.targetContext = null;
      return;
    }

    const nextContext = `${human.ship}:${human.deck}:${human.alive === false ? "out" : "alive"}`;
    if (easy.targetContext && easy.targetContext !== nextContext) {
      // Easy briefly loses track when the player changes deck/state instead of
      // instantly knowing the correct hatch route.
      easy.lostTargetUntil = now + 800 + Math.random() * 650;
    }
    easy.targetContext = nextContext;
  }

  function rigMask(network, easy, now) {
    const { ship } = context(network);
    if (!ship) return null;

    const brain = network.__kdj0201Brain;
    const realTrim = Number(ship.sailTrim ?? 1);
    const alreadyServicing = brain?.task === "rigging" || brain?.task === "returnHelm";

    if (realTrim === 2) {
      easy.forgetCruising = null;
      easy.reefedReactAt = 0;
    } else if (realTrim === 1 && easy.lastTrim !== 1) {
      // Keep 0.20.5's one-time 50/50 memory check at each arrival at Cruising.
      easy.forgetCruising = Math.random() < 0.5;
      easy.reefedReactAt = 0;
    } else if (realTrim === 0 && easy.lastTrim !== 0) {
      easy.forgetCruising = false;
      // Reefed is guaranteed to be fixed, but Easy takes 1–3 seconds to notice
      // unless it was already walking to the rigging.
      easy.reefedReactAt = alreadyServicing ? 0 : now + 1000 + Math.random() * 2000;
    }

    easy.lastTrim = realTrim;

    const hideCruising = realTrim === 1 && easy.forgetCruising === true && !alreadyServicing;
    const hideReefed = realTrim === 0 && !alreadyServicing && easy.reefedReactAt > now;
    return { ship, realTrim, masked: hideCruising || hideReefed };
  }

  // The real controller installs its 100 ms loop after createRoom returns. Easy
  // lets that loop exist, but only permits a full tactical decision every 350 ms.
  // The authoritative host continues to hold the previous input between decisions.
  window.setInterval = function setInterval0209Easy(callback, delay, ...args) {
    if (intervalTarget && Number(delay) === 100 && typeof callback === "function") {
      const network = intervalTarget;
      intervalTarget = null;
      const wrapped = (...callbackArgs) => {
        if (!isEasy(network)) return callback(...callbackArgs);

        const easy = network.__kdj0209EasyState;
        if (!easy) return callback(...callbackArgs);
        const now = Date.now();
        updateAwareness(network, easy, now);
        const rig = rigMask(network, easy, now);

        if (now < easy.nextThinkAt) return;
        easy.nextThinkAt = now + THINK_DELAY_MS;

        if (rig?.masked) {
          rig.ship.sailTrim = 2;
          try {
            return callback(...callbackArgs);
          } finally {
            if (rig.ship.sailTrim === 2) rig.ship.sailTrim = rig.realTrim;
          }
        }

        return callback(...callbackArgs);
      };
      return nativeSetInterval(wrapped, delay, ...args);
    }
    return nativeSetInterval(callback, delay, ...args);
  };

  function scheduleEasyFire(network, easy, input, fireSeq, originalOnPacket) {
    const now = Date.now();
    const delay = 700 + Math.random() * 800;
    const brain = network.__kdj0201Brain;

    // Keep James at the cannon while he hesitates, then another 1–2 seconds after
    // the shot instead of immediately snapping back to the helm task.
    if (brain) brain.gunnerUntil = Math.max(Number(brain.gunnerUntil || 0), now + delay + 1200);

    easy.pendingFireTimer = setTimeout(() => {
      easy.pendingFireTimer = null;
      if (!isEasy(network)) return;

      const { state, bot, ship } = context(network);
      if (!state || !bot || !ship || bot.role !== "gunner") return;
      const cannon = ship.cannons?.[bot.cannonIndex];
      if (!cannon || cannon.gunner !== BOT_ID) return;

      // Medium chooses the exact computed aim. Easy adds up to ±7° immediately
      // before the authoritative fire input, so some otherwise-good shots miss.
      cannon.aim = clamp(Number(cannon.aim || 0) + (Math.random() * 2 - 1) * CANNON_AIM_ERROR, -0.49, 0.49);
      easy.acceptedFireSeq = fireSeq;

      const delayedInput = {
        ...input,
        w: false, s: false, a: false, d: false,
        fireSeq,
        swordSeq: easy.acceptedSwordSeq,
        grappleSeq: easy.acceptedGrappleSeq
      };
      originalOnPacket?.(BOT_ID, { type: "input", input: delayedInput });

      if (brain) brain.gunnerUntil = Date.now() + 1000 + Math.random() * 1000;
    }, delay);
  }

  function softenInput(network, easy, input, originalOnPacket) {
    const now = Date.now();
    const next = { ...input };
    const { bot } = context(network);

    // Periodic visible thinking pauses.
    if (now >= easy.nextHesitationAt) {
      easy.hesitationUntil = now + 400 + Math.random() * 400;
      easy.nextHesitationAt = now + 2600 + Math.random() * 2400;
    }

    // Mild oversteer: when the requested turn changes, Easy sometimes keeps the
    // old rudder direction for one extra beat before correcting.
    const desiredTurn = input.a ? -1 : (input.d ? 1 : 0);
    if (desiredTurn !== easy.lastDesiredTurn) {
      if (easy.appliedTurn !== 0 && desiredTurn !== easy.appliedTurn && Math.random() < 0.55) {
        easy.oversteerUntil = now + 250 + Math.random() * 450;
      }
      easy.lastDesiredTurn = desiredTurn;
    }
    if (now < easy.oversteerUntil && easy.appliedTurn !== 0) {
      next.a = easy.appliedTurn < 0;
      next.d = easy.appliedTurn > 0;
    } else {
      easy.appliedTurn = desiredTurn;
    }

    if (now < easy.hesitationUntil || now < easy.lostTargetUntil) {
      next.w = next.s = next.a = next.d = false;
    }

    // While Easy has temporarily lost the player on an enemy ship, also postpone
    // hatch interactions instead of letting perfect state knowledge leak through.
    const interactSeq = Number(input.interactSeq || 0);
    if (bot?.ship !== bot?.team && now < easy.lostTargetUntil) {
      next.interactSeq = easy.acceptedInteractSeq;
    } else {
      easy.acceptedInteractSeq = interactSeq;
      next.interactSeq = interactSeq;
    }

    const swordSeq = Number(input.swordSeq || 0);
    if (swordSeq > easy.seenSwordSeq) {
      easy.seenSwordSeq = swordSeq;
      if (now - easy.lastSwordAt >= 1500 && Math.random() < 0.72) {
        easy.acceptedSwordSeq = swordSeq;
        easy.lastSwordAt = now;
      }
    }
    next.swordSeq = easy.acceptedSwordSeq;

    const grappleSeq = Number(input.grappleSeq || 0);
    if (grappleSeq > easy.seenGrappleSeq) {
      easy.seenGrappleSeq = grappleSeq;
      // Easy commits to only about one in three boarding opportunities.
      if (Math.random() < 0.34) easy.acceptedGrappleSeq = grappleSeq;
    }
    next.grappleSeq = easy.acceptedGrappleSeq;

    const fireSeq = Number(input.fireSeq || 0);
    if (fireSeq > easy.seenFireSeq) {
      easy.seenFireSeq = fireSeq;
      // Sometimes pass up a valid broadside entirely. Otherwise hesitate before
      // firing; scheduleEasyFire keeps the bot at the cannon during the delay.
      if (!easy.pendingFireTimer && Math.random() < 0.62) {
        scheduleEasyFire(network, easy, input, fireSeq, originalOnPacket);
      }
    }
    // Hide an unaccepted/pending fire sequence from the host until the delayed shot.
    next.fireSeq = easy.acceptedFireSeq;

    return next;
  }

  Network.prototype.createRoom = async function createRoom0209Easy(name) {
    const room = await previousCreateRoom.call(this, name);
    if (!isEasy(this)) return room;

    const easy = makeEasyState();
    this.__kdj0209EasyState = easy;
    intervalTarget = this;

    const originalOnPacket = this.callbacks.onPacket;
    this.__kdj0209EasyOriginalOnPacket = originalOnPacket;
    this.callbacks.onPacket = (from, packet) => {
      if (from === BOT_ID && packet?.type === "input" && packet.input) {
        const softened = softenInput(this, easy, packet.input, originalOnPacket);
        return originalOnPacket?.(from, { ...packet, input: softened });
      }
      return originalOnPacket?.(from, packet);
    };

    return room;
  };

  Network.prototype.cleanup = function cleanup0209Easy() {
    const easy = this.__kdj0209EasyState;
    if (easy?.pendingFireTimer) clearTimeout(easy.pendingFireTimer);
    if (intervalTarget === this) intervalTarget = null;

    if (this.__kdj0209EasyOriginalOnPacket) {
      this.callbacks.onPacket = this.__kdj0209EasyOriginalOnPacket;
    }
    this.__kdj0209EasyOriginalOnPacket = null;
    this.__kdj0209EasyState = null;
    return previousCleanup.call(this);
  };
})();