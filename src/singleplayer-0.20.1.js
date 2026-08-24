(() => {
  const BOT_ID = "kdj2-local-bot";
  const BOT_NAME = "James Bot";
  const THINK_MS = 100;
  const RIG_X = -2.15;
  const RIG_Z = -2.2;
  const HELM_X = 0;
  const HELM_Z = 10.65;

  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const originalCreateRoom = Network.prototype.createRoom;
  const originalCleanup = Network.prototype.cleanup;

  function normalizeAngle(value) {
    return Math.atan2(Math.sin(value), Math.cos(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function otherTeam(team) {
    return team === "british" ? "french" : "british";
  }

  function makeAi() {
    return {
      state: null,
      timer: null,
      round: 0,
      fireSeq: 0,
      grappleSeq: 0,
      swordSeq: 0,
      interactSeq: 0,
      rigSeq: 0,
      lastSwordAt: 0,
      lastInteractAt: 0,
      lastRigAt: 0,
      lastBoardAttemptAt: 0,
      gunnerUntil: 0,
      boardUntil: 0,
      task: null,
      nextRiggingCheckAt: 0
    };
  }

  function neutralInput(ai, yaw = 0) {
    return {
      w: false,
      s: false,
      a: false,
      d: false,
      cannonLeft: false,
      cannonRight: false,
      yaw,
      interactSeq: ai.interactSeq,
      grappleSeq: ai.grappleSeq,
      rigSeq: ai.rigSeq,
      fireSeq: ai.fireSeq,
      swordSeq: ai.swordSeq,
      interactHeld: false
    };
  }

  function sendBotInput(network, input) {
    network.callbacks.onPacket?.(BOT_ID, { type: "input", input });
  }

  function humanPlayer(state) {
    return Object.values(state?.players || {}).find((p) => p.id !== BOT_ID) || null;
  }

  function movementToward(ai, p, targetX, targetZ) {
    const dx = targetX - p.x;
    const dz = targetZ - p.z;
    const distance = Math.hypot(dx, dz);
    // Player forward motion is (-sin(yaw), -cos(yaw)).
    const yaw = Math.atan2(-dx, -dz);
    const input = neutralInput(ai, yaw);
    input.w = distance > 0.3;
    return { input, distance };
  }

  function requestInteract(network, ai, p, now, input = null) {
    if (now - ai.lastInteractAt < 450) return false;
    ai.interactSeq += 1;
    ai.lastInteractAt = now;
    const next = input || neutralInput(ai, p?.yaw || 0);
    next.interactSeq = ai.interactSeq;
    sendBotInput(network, next);
    return true;
  }

  function releaseCurrentStation(network, ai, p, now) {
    if (!p?.role) return false;
    requestInteract(network, ai, p, now);
    return true;
  }

  function ensureHelm(network, ai, state, p, now) {
    if (p.role === "captain") return true;
    if (p.role) {
      releaseCurrentStation(network, ai, p, now);
      return false;
    }
    if (p.deck !== "upper" || p.ship !== p.team) return false;

    const move = movementToward(ai, p, HELM_X, HELM_Z);
    if (move.distance <= 1.45) {
      move.input.w = false;
      requestInteract(network, ai, p, now, move.input);
    } else {
      sendBotInput(network, move.input);
    }
    return false;
  }

  function aimForBroadside(ship, enemyShip) {
    const dx = enemyShip.x - ship.x;
    const dz = enemyShip.z - ship.z;
    const distance = Math.hypot(dx, dz) || 1;
    const rightX = Math.cos(ship.heading);
    const rightZ = -Math.sin(ship.heading);
    // Cannon aim in the existing game uses the historical +sin/+cos aim axis.
    const cannonForwardX = Math.sin(ship.heading);
    const cannonForwardZ = Math.cos(ship.heading);
    const right = dx * rightX + dz * rightZ;
    const cannonForward = dx * cannonForwardX + dz * cannonForwardZ;
    const side = right >= 0 ? 1 : -1;
    const aim = Math.atan2(cannonForward, Math.abs(right));
    return { distance, side, aim, broadsideRatio: Math.abs(right) / distance };
  }

  function chooseReadyCannon(ship, side, now) {
    let best = null;
    for (let index = 0; index < (ship.cannons || []).length; index += 1) {
      const cannon = ship.cannons[index];
      if (cannon.side !== side) continue;
      const age = now - Number(cannon.lastFire || 0);
      if (age < 7900) continue;
      if (!best || age > best.age) best = { index, cannon, age };
    }
    return best;
  }

  function releaseStationsDirectlyForBeta(state, p) {
    // Cannon occupation is still beta-era station logic. 0.20.1 specifically removes
    // magical sail control; helm and rigging transitions use normal interactions.
    if (!state || !p) return;
    for (const ship of Object.values(state.ships || {})) {
      if (ship.captain === BOT_ID) ship.captain = null;
      if (ship.sailmaster === BOT_ID) ship.sailmaster = null;
      for (const cannon of ship.cannons || []) {
        if (cannon.gunner === BOT_ID) cannon.gunner = null;
      }
    }
    p.role = null;
    p.cannonIndex = null;
  }

  function takeCannonBeta(state, p, index) {
    if (!state || !p || p.ship !== p.team || p.deck !== "upper") return false;
    const ship = state.ships?.[p.team];
    const cannon = ship?.cannons?.[index];
    if (!cannon) return false;
    releaseStationsDirectlyForBeta(state, p);
    cannon.gunner = BOT_ID;
    p.role = "gunner";
    p.cannonIndex = index;
    p.x = cannon.x - cannon.side * 0.78;
    p.z = cannon.z;
    return true;
  }

  function fireBroadside(network, ai, state, p, ship, enemyShip, now) {
    const aim = aimForBroadside(ship, enemyShip);
    if (aim.distance > 118 || aim.distance < 18) return false;
    if (aim.broadsideRatio < 0.87 || Math.abs(aim.aim) > 0.47) return false;

    const choice = chooseReadyCannon(ship, aim.side, now);
    if (!choice) return false;
    if (!takeCannonBeta(state, p, choice.index)) return false;

    choice.cannon.aim = clamp(aim.aim, -0.45, 0.45);
    ai.fireSeq += 1;
    ai.gunnerUntil = now + 550;
    const input = neutralInput(ai, p.yaw || 0);
    input.fireSeq = ai.fireSeq;
    sendBotInput(network, input);
    return true;
  }

  function desiredPursuitHeading(ship, enemyShip, distance) {
    const dx = enemyShip.x - ship.x;
    const dz = enemyShip.z - ship.z;

    // KdJ2 0.11.1 made the visible bow travel along (-sin(h), -cos(h)).
    // The 0.20.0 beta still used atan2(dx, dz), which points the STERN at the target.
    const forwardHeading = Math.atan2(-dx, -dz);
    if (distance >= 92) return forwardHeading;

    // Inside fighting range, turn perpendicular to set up the nearest broadside.
    const starboardBroadside = Math.atan2(-dz, dx);
    const portBroadside = normalizeAngle(starboardBroadside + Math.PI);
    const starboardError = Math.abs(normalizeAngle(starboardBroadside - ship.heading));
    const portError = Math.abs(normalizeAngle(portBroadside - ship.heading));
    return starboardError <= portError ? starboardBroadside : portBroadside;
  }

  function helmInput(ai, ship, desiredHeading, distance) {
    const input = neutralInput(ai, 0);
    const error = normalizeAngle(desiredHeading - ship.heading);

    // Host ship simulation uses D to increase heading and A to decrease it for
    // remote/player input records. Keep a small dead zone so the helm does not jitter.
    if (error > 0.035) input.d = true;
    else if (error < -0.035) input.a = true;

    // Use the real throttle. No direct ship.speed writes in 0.20.1.
    if (distance > 42) input.w = true;
    else if (distance < 24 && Number(ship.speed || 0) > 1.15) input.s = true;

    return input;
  }

  function shouldServiceRigging(ai, ship, distance, now) {
    if (ai.task === "rigging" || ai.task === "returnHelm") return true;
    if (now < ai.nextRiggingCheckAt) return false;
    if (distance < 62) return false;
    return Number(ship.sailTrim ?? 1) < 2;
  }

  function serviceRigging(network, ai, state, p, ship, now) {
    if (ai.task !== "returnHelm") ai.task = "rigging";

    if (ai.task === "returnHelm") {
      if (p.role === "captain") {
        ai.task = null;
        ai.nextRiggingCheckAt = now + 1500;
        return false;
      }
      ensureHelm(network, ai, state, p, now);
      return true;
    }

    if (p.role === "captain" || p.role === "gunner") {
      releaseCurrentStation(network, ai, p, now);
      return true;
    }

    if (p.role === "sailmaster") {
      if (Number(ship.sailTrim ?? 1) < 2) {
        if (now - ai.lastRigAt >= 500) {
          ai.rigSeq += 1;
          ai.lastRigAt = now;
          const input = neutralInput(ai, p.yaw || 0);
          input.rigSeq = ai.rigSeq;
          sendBotInput(network, input);
        }
        return true;
      }

      if (requestInteract(network, ai, p, now)) {
        ai.task = "returnHelm";
      }
      return true;
    }

    if (p.role) {
      releaseCurrentStation(network, ai, p, now);
      return true;
    }

    // Walk across the actual deck to the rigging station. Only once the bot is
    // physically in interaction range does it press E and then use the normal
    // rigSeq/handleRigging path to change sails.
    const move = movementToward(ai, p, RIG_X, RIG_Z);
    if (move.distance <= 1.45) {
      move.input.w = false;
      requestInteract(network, ai, p, now, move.input);
    } else {
      sendBotInput(network, move.input);
    }
    return true;
  }

  function steerShipBot(network, ai, state, p, now) {
    const ship = state.ships?.[p.team];
    const enemyShip = state.ships?.[otherTeam(p.team)];
    if (!ship || !enemyShip || ship.destroyed || enemyShip.destroyed) return;

    const distance = Math.hypot(enemyShip.x - ship.x, enemyShip.z - ship.z) || 1;

    if (now < ai.gunnerUntil && p.role === "gunner") {
      sendBotInput(network, neutralInput(ai, p.yaw || 0));
      return;
    }

    if (shouldServiceRigging(ai, ship, distance, now)) {
      serviceRigging(network, ai, state, p, ship, now);
      return;
    }

    if (!ensureHelm(network, ai, state, p, now)) return;

    const desiredHeading = desiredPursuitHeading(ship, enemyShip, distance);
    sendBotInput(network, helmInput(ai, ship, desiredHeading, distance));

    if (fireBroadside(network, ai, state, p, ship, enemyShip, now)) return;

    const human = humanPlayer(state);
    const shouldBoard = distance < 30 && now - ai.lastBoardAttemptAt > 7000 &&
      (Number(enemyShip.mobility || 100) <= 48 || Number(ship.mobility || 100) <= 34 || human?.alive === false);

    if (shouldBoard) {
      requestInteract(network, ai, p, now); // leave helm through the normal station interaction
      ai.lastBoardAttemptAt = now;
      ai.task = "board";
      return;
    }

    if (ai.task === "board" && !p.role) {
      // Boarding still uses the existing authoritative grapple system. Move off the
      // helm first, then trigger the same G/grapple sequence as a human.
      const center = movementToward(ai, p, 0, 0);
      if (center.distance <= 1.3) {
        center.input.w = false;
        ai.grappleSeq += 1;
        ai.boardUntil = now + 1450;
        center.input.grappleSeq = ai.grappleSeq;
        ai.task = null;
      }
      sendBotInput(network, center.input);
    }
  }

  function boardCombat(network, ai, state, p, now) {
    if (now < ai.boardUntil || p.boardingCompleteAt) {
      sendBotInput(network, neutralInput(ai, p.yaw || 0));
      return;
    }

    const human = humanPlayer(state);
    if (human?.alive !== false && human?.ship === p.ship) {
      if (human.deck !== p.deck) {
        const move = movementToward(ai, p, 0, 3.3);
        if (move.distance <= 1.35 && now - ai.lastInteractAt > 900) {
          ai.interactSeq += 1;
          ai.lastInteractAt = now;
          move.input.interactSeq = ai.interactSeq;
        }
        sendBotInput(network, move.input);
        return;
      }

      const move = movementToward(ai, p, human.x, human.z);
      if (move.distance <= 2.25 && now - ai.lastSwordAt > 900) {
        ai.swordSeq += 1;
        ai.lastSwordAt = now;
        move.input.swordSeq = ai.swordSeq;
      }
      if (move.distance < 1.45) move.input.w = false;
      sendBotInput(network, move.input);
      return;
    }

    if (p.deck === "upper") {
      const move = movementToward(ai, p, 0, 3.3);
      if (move.distance <= 1.35 && now - ai.lastInteractAt > 900) {
        ai.interactSeq += 1;
        ai.lastInteractAt = now;
        move.input.interactSeq = ai.interactSeq;
      }
      sendBotInput(network, move.input);
      return;
    }

    const flag = movementToward(ai, p, 0, -7.5);
    if (flag.distance <= 2.0) {
      flag.input.w = false;
      flag.input.interactHeld = true;
    }
    sendBotInput(network, flag.input);
  }

  function resetAiForRound(ai) {
    ai.round = 0;
    ai.gunnerUntil = 0;
    ai.boardUntil = 0;
    ai.lastBoardAttemptAt = 0;
    ai.task = null;
    ai.nextRiggingCheckAt = 0;
  }

  function botThink(network) {
    const ai = network.__kdjBotAi;
    const state = ai?.state;
    if (!network.__kdjSinglePlayer || !ai || !state) return;

    const p = state.players?.[BOT_ID];
    if (!p) return;

    const now = Date.now();
    if (Number(state.round || 0) !== ai.round) {
      ai.round = Number(state.round || 0);
      ai.gunnerUntil = 0;
      ai.boardUntil = 0;
      ai.lastBoardAttemptAt = 0;
      ai.task = null;
      ai.nextRiggingCheckAt = 0;
    }

    if (state.phase !== "playing" || !p.spawned || p.alive === false) {
      sendBotInput(network, neutralInput(ai, p.yaw || 0));
      return;
    }

    if (p.ship !== p.team) boardCombat(network, ai, state, p, now);
    else steerShipBot(network, ai, state, p, now);
  }

  function startBotLoop(network) {
    const ai = network.__kdjBotAi;
    if (!ai || ai.timer) return;
    ai.timer = setInterval(() => botThink(network), THINK_MS);
  }

  function observeBotPacket(network, packet) {
    const ai = network.__kdjBotAi;
    if (!ai || !packet || typeof packet !== "object") return;
    if (packet.type === "welcome" && packet.state) ai.state = packet.state;
    if (packet.type === "state" && packet.state) ai.state = packet.state;
    startBotLoop(network);
  }

  function injectBot(network) {
    if (!network.__kdjSinglePlayer) return;

    const fakeConnection = {
      peer: BOT_ID,
      open: true,
      send(packet) { observeBotPacket(network, packet); },
      close() { this.open = false; }
    };

    network.pendingGuests.set(BOT_ID, fakeConnection);
    network.callbacks.onJoinRequest?.({ peerId: BOT_ID, name: BOT_NAME });

    setTimeout(() => {
      if (!network.__kdjSinglePlayer) return;
      network.callbacks.onPacket?.(BOT_ID, { type: "spawn" });
      network.status("Single player · local", "direct");
    }, 40);
  }

  Network.prototype.createRoom = async function createRoom0201(name) {
    if (!window.__KDJ_SINGLEPLAYER_NEXT__) {
      return originalCreateRoom.call(this, name);
    }

    window.__KDJ_SINGLEPLAYER_NEXT__ = false;
    originalCleanup.call(this);

    this.__kdjSinglePlayer = true;
    this.__kdjBotAi = makeAi();
    resetAiForRound(this.__kdjBotAi);
    this.isHost = true;
    this.selfId = `kdj2-local-human-${Math.random().toString(36).slice(2, 10)}`;
    this.roomCode = [];

    window.__KDJ_SINGLEPLAYER_ACTIVE__ = true;
    document.body.classList.add("kdj-singleplayer");
    this.status("Single player · local", "direct");

    setTimeout(() => injectBot(this), 0);
    return { id: this.selfId, code: [], name };
  };

  Network.prototype.cleanup = function cleanup0201() {
    const ai = this.__kdjBotAi;
    if (ai?.timer) clearInterval(ai.timer);
    this.__kdjBotAi = null;
    this.__kdjSinglePlayer = false;

    const result = originalCleanup.call(this);
    if (window.__KDJ_SINGLEPLAYER_ACTIVE__) {
      window.__KDJ_SINGLEPLAYER_ACTIVE__ = false;
      document.body.classList.remove("kdj-singleplayer");
    }
    return result;
  };

  function wireButton() {
    const button = document.querySelector("#singlePlayerBtn");
    if (!button || button.dataset.kdjSingleBound === "true") return;
    button.dataset.kdjSingleBound = "true";
    button.addEventListener("click", () => {
      window.__KDJ_SINGLEPLAYER_NEXT__ = true;
      document.querySelector("#createRoomBtn")?.click();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireButton, { once: true });
  else wireButton();
})();
