(() => {
  const BOT_ID = "kdj2-local-bot";
  const BOT_NAME = "James Bot";
  const THINK_MS = 100;

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
      lastBoardAttemptAt: 0,
      gunnerUntil: 0,
      boardUntil: 0
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

  function releaseStations(state, p) {
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

  function takeHelm(state, p) {
    if (!state || !p || p.ship !== p.team || p.deck !== "upper") return false;
    const ship = state.ships?.[p.team];
    if (!ship) return false;
    releaseStations(state, p);
    ship.captain = BOT_ID;
    p.role = "captain";
    p.cannonIndex = null;
    p.x = 0;
    p.z = 9;
    return true;
  }

  function takeCannon(state, p, index) {
    if (!state || !p || p.ship !== p.team || p.deck !== "upper") return false;
    const ship = state.ships?.[p.team];
    const cannon = ship?.cannons?.[index];
    if (!cannon) return false;
    releaseStations(state, p);
    cannon.gunner = BOT_ID;
    p.role = "gunner";
    p.cannonIndex = index;
    p.x = cannon.x - cannon.side * 0.78;
    p.z = cannon.z;
    return true;
  }

  function rotateToward(current, target, maxStep) {
    const diff = normalizeAngle(target - current);
    return normalizeAngle(current + clamp(diff, -maxStep, maxStep));
  }

  function humanPlayer(state) {
    return Object.values(state?.players || {}).find((p) => p.id !== BOT_ID) || null;
  }

  function aimForBroadside(ship, enemyShip) {
    const dx = enemyShip.x - ship.x;
    const dz = enemyShip.z - ship.z;
    const distance = Math.hypot(dx, dz) || 1;
    const rightX = Math.cos(ship.heading);
    const rightZ = -Math.sin(ship.heading);
    const forwardX = Math.sin(ship.heading);
    const forwardZ = Math.cos(ship.heading);
    const right = dx * rightX + dz * rightZ;
    const forward = dx * forwardX + dz * forwardZ;
    const side = right >= 0 ? 1 : -1;
    const aim = Math.atan2(forward, Math.abs(right));
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

  function fireBroadside(network, ai, state, p, ship, enemyShip, now) {
    const aim = aimForBroadside(ship, enemyShip);
    if (aim.distance > 118 || aim.distance < 18) return false;
    if (aim.broadsideRatio < 0.87 || Math.abs(aim.aim) > 0.47) return false;

    const choice = chooseReadyCannon(ship, aim.side, now);
    if (!choice) return false;
    if (!takeCannon(state, p, choice.index)) return false;

    choice.cannon.aim = clamp(aim.aim, -0.45, 0.45);
    ai.fireSeq += 1;
    ai.gunnerUntil = now + 550;
    const input = neutralInput(ai, p.yaw || 0);
    input.fireSeq = ai.fireSeq;
    sendBotInput(network, input);
    return true;
  }

  function steerShipBot(network, ai, state, p, now) {
    const ship = state.ships?.[p.team];
    const enemyShip = state.ships?.[otherTeam(p.team)];
    if (!ship || !enemyShip || ship.destroyed || enemyShip.destroyed) return;

    if (now < ai.gunnerUntil && p.role === "gunner") {
      sendBotInput(network, neutralInput(ai, p.yaw || 0));
      return;
    }

    const dx = enemyShip.x - ship.x;
    const dz = enemyShip.z - ship.z;
    const distance = Math.hypot(dx, dz) || 1;
    const forwardHeading = Math.atan2(dx, dz);

    let desiredHeading = forwardHeading;
    if (distance < 92) {
      const starboardBroadside = Math.atan2(-dz, dx);
      const portBroadside = normalizeAngle(starboardBroadside + Math.PI);
      const starboardError = Math.abs(normalizeAngle(starboardBroadside - ship.heading));
      const portError = Math.abs(normalizeAngle(portBroadside - ship.heading));
      desiredHeading = starboardError <= portError ? starboardBroadside : portBroadside;
    }

    takeHelm(state, p);

    // Beta bot steering is applied to the same authoritative ship object the host
    // simulates. Collision, projectiles, damage and victory rules remain the real
    // game systems; this only replaces a human hand on the wheel.
    ship.heading = rotateToward(ship.heading, desiredHeading, distance > 92 ? 0.032 : 0.046);
    ship.sailTrim = 2;
    ship.sailDecayAt = Date.now() + 60000;

    const mobility = clamp(Number(ship.mobility || 0) / 100, 0, 1);
    let targetSpeed = 4.8 * mobility;
    if (distance < 100) targetSpeed = 3.5 * mobility;
    if (distance < 68) targetSpeed = 2.25 * mobility;
    if (distance < 42) targetSpeed = 1.15 * mobility;
    if (distance < 25) targetSpeed = 0.55 * mobility;
    ship.speed += clamp(targetSpeed - Number(ship.speed || 0), -0.18, 0.18);

    if (fireBroadside(network, ai, state, p, ship, enemyShip, now)) return;

    const human = humanPlayer(state);
    const shouldBoard = distance < 30 && now - ai.lastBoardAttemptAt > 7000 &&
      (Number(enemyShip.mobility || 100) <= 48 || Number(ship.mobility || 100) <= 34 || human?.alive === false);

    if (shouldBoard) {
      releaseStations(state, p);
      p.deck = "upper";
      p.x = 0;
      p.z = 0;
      ai.grappleSeq += 1;
      ai.lastBoardAttemptAt = now;
      ai.boardUntil = now + 1450;
      const input = neutralInput(ai, p.yaw || 0);
      input.grappleSeq = ai.grappleSeq;
      sendBotInput(network, input);
      return;
    }

    const input = neutralInput(ai, p.yaw || 0);
    input.w = targetSpeed > 0.4;
    sendBotInput(network, input);
  }

  function movementToward(ai, p, targetX, targetZ) {
    const dx = targetX - p.x;
    const dz = targetZ - p.z;
    const distance = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    const input = neutralInput(ai, yaw);
    input.w = distance > 0.3;
    return { input, distance };
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

    // With the enemy sailor gone or elsewhere, finish the actual objective instead
    // of inventing a special bot win condition: go below deck and hold the flag.
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

  function resetAiForRound(ai, state, p) {
    ai.round = Number(state.round || 0);
    ai.gunnerUntil = 0;
    ai.boardUntil = 0;
    ai.lastBoardAttemptAt = 0;
    releaseStations(state, p);
  }

  function botThink(network) {
    const ai = network.__kdjBotAi;
    const state = ai?.state;
    if (!network.__kdjSinglePlayer || !ai || !state) return;

    const p = state.players?.[BOT_ID];
    if (!p) return;

    const now = Date.now();
    if (Number(state.round || 0) !== ai.round) resetAiForRound(ai, state, p);

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

  Network.prototype.createRoom = async function createRoom0200(name) {
    if (!window.__KDJ_SINGLEPLAYER_NEXT__) {
      return originalCreateRoom.call(this, name);
    }

    window.__KDJ_SINGLEPLAYER_NEXT__ = false;
    originalCleanup.call(this);

    this.__kdjSinglePlayer = true;
    this.__kdjBotAi = makeAi();
    this.isHost = true;
    this.selfId = `kdj2-local-human-${Math.random().toString(36).slice(2, 10)}`;
    this.roomCode = [];

    window.__KDJ_SINGLEPLAYER_ACTIVE__ = true;
    document.body.classList.add("kdj-singleplayer");
    this.status("Single player · local", "direct");

    setTimeout(() => injectBot(this), 0);
    return { id: this.selfId, code: [], name };
  };

  Network.prototype.cleanup = function cleanup0200() {
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
