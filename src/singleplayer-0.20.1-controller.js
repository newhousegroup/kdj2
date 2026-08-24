(() => {
  const BOT_ID = "kdj2-local-bot";
  const THINK_MS = 100;
  const RIG = { x: -2.15, z: -2.2 };
  const HELM = { x: 0, z: 10.65 };

  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const previousCreateRoom = Network.prototype.createRoom;
  const previousCleanup = Network.prototype.cleanup;

  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const enemyTeam = (team) => team === "british" ? "french" : "british";

  function brain() {
    return {
      task: null,
      lastInteract: 0,
      lastRig: 0,
      lastSword: 0,
      lastBoard: 0,
      gunnerUntil: 0,
      boardUntil: 0,
      round: 0
    };
  }

  function input(ai, yaw = 0) {
    return {
      w: false, s: false, a: false, d: false,
      cannonLeft: false, cannonRight: false,
      yaw,
      interactSeq: ai.interactSeq,
      grappleSeq: ai.grappleSeq,
      rigSeq: ai.rigSeq,
      fireSeq: ai.fireSeq,
      swordSeq: ai.swordSeq,
      interactHeld: false
    };
  }

  function send(net, packet) {
    net.callbacks.onPacket?.(BOT_ID, { type: "input", input: packet });
  }

  function moveTo(ai, p, x, z) {
    const dx = x - p.x;
    const dz = z - p.z;
    const distance = Math.hypot(dx, dz);
    const out = input(ai, Math.atan2(-dx, -dz));
    out.w = distance > 0.3;
    return { out, distance };
  }

  function tapInteract(net, ai, b, p, now, out = null) {
    if (now - b.lastInteract < 450) return false;
    b.lastInteract = now;
    ai.interactSeq += 1;
    const next = out || input(ai, p.yaw || 0);
    next.interactSeq = ai.interactSeq;
    send(net, next);
    return true;
  }

  function ensureHelm(net, ai, b, p, now) {
    if (p.role === "captain") return true;
    if (p.role) {
      tapInteract(net, ai, b, p, now);
      return false;
    }
    const walk = moveTo(ai, p, HELM.x, HELM.z);
    if (walk.distance <= 1.45) {
      walk.out.w = false;
      tapInteract(net, ai, b, p, now, walk.out);
    } else send(net, walk.out);
    return false;
  }

  function serviceRigging(net, ai, b, p, ship, now) {
    if (b.task !== "returnHelm") b.task = "rigging";

    if (b.task === "returnHelm") {
      if (p.role === "captain") {
        b.task = null;
        return false;
      }
      ensureHelm(net, ai, b, p, now);
      return true;
    }

    if (p.role && p.role !== "sailmaster") {
      tapInteract(net, ai, b, p, now);
      return true;
    }

    if (p.role === "sailmaster") {
      if (Number(ship.sailTrim ?? 1) < 2) {
        if (now - b.lastRig >= 500) {
          b.lastRig = now;
          ai.rigSeq += 1;
          const out = input(ai, p.yaw || 0);
          out.rigSeq = ai.rigSeq;
          send(net, out);
        }
      } else if (tapInteract(net, ai, b, p, now)) {
        b.task = "returnHelm";
      }
      return true;
    }

    const walk = moveTo(ai, p, RIG.x, RIG.z);
    if (walk.distance <= 1.45) {
      walk.out.w = false;
      tapInteract(net, ai, b, p, now, walk.out);
    } else send(net, walk.out);
    return true;
  }

  function pursuitHeading(ship, enemy, distance) {
    const dx = enemy.x - ship.x;
    const dz = enemy.z - ship.z;

    // Since 0.11.1 the bow travels along (-sin(h), -cos(h)).
    // 0.20.0-beta used the opposite convention, hence the full-speed retreat.
    const toward = Math.atan2(-dx, -dz);
    if (distance >= 92) return toward;

    const starboard = Math.atan2(-dz, dx);
    const port = norm(starboard + Math.PI);
    return Math.abs(norm(starboard - ship.heading)) <= Math.abs(norm(port - ship.heading)) ? starboard : port;
  }

  function steer(ai, ship, heading, distance) {
    const out = input(ai, 0);
    const error = norm(heading - ship.heading);
    if (error > 0.035) out.d = true;
    else if (error < -0.035) out.a = true;

    // Real helm controls only: no direct heading or speed mutation.
    if (distance > 42) out.w = true;
    else if (distance < 24 && Number(ship.speed || 0) > 1.15) out.s = true;
    return out;
  }

  function human(state) {
    return Object.values(state.players || {}).find((p) => p.id !== BOT_ID) || null;
  }

  function cannonAim(ship, enemy) {
    const dx = enemy.x - ship.x;
    const dz = enemy.z - ship.z;
    const distance = Math.hypot(dx, dz) || 1;
    const rightX = Math.cos(ship.heading);
    const rightZ = -Math.sin(ship.heading);
    const oldForwardX = Math.sin(ship.heading);
    const oldForwardZ = Math.cos(ship.heading);
    const right = dx * rightX + dz * rightZ;
    const forward = dx * oldForwardX + dz * oldForwardZ;
    return {
      distance,
      side: right >= 0 ? 1 : -1,
      aim: Math.atan2(forward, Math.abs(right)),
      broadside: Math.abs(right) / distance
    };
  }

  function takeCannon(state, p, index) {
    const ship = state.ships?.[p.team];
    const cannon = ship?.cannons?.[index];
    if (!cannon) return false;
    if (ship.captain === BOT_ID) ship.captain = null;
    if (ship.sailmaster === BOT_ID) ship.sailmaster = null;
    for (const c of ship.cannons || []) if (c.gunner === BOT_ID) c.gunner = null;
    p.role = "gunner";
    p.cannonIndex = index;
    cannon.gunner = BOT_ID;
    p.x = cannon.x - cannon.side * 0.78;
    p.z = cannon.z;
    return true;
  }

  function tryFire(net, ai, b, state, p, ship, enemy, now) {
    const aim = cannonAim(ship, enemy);
    if (aim.distance < 18 || aim.distance > 118 || aim.broadside < 0.87 || Math.abs(aim.aim) > 0.47) return false;

    let choice = -1;
    let oldest = -1;
    for (let i = 0; i < (ship.cannons || []).length; i += 1) {
      const c = ship.cannons[i];
      if (c.side !== aim.side) continue;
      const age = now - Number(c.lastFire || 0);
      if (age >= 7900 && age > oldest) { choice = i; oldest = age; }
    }
    if (choice < 0 || !takeCannon(state, p, choice)) return false;

    ship.cannons[choice].aim = clamp(aim.aim, -0.45, 0.45);
    ai.fireSeq += 1;
    const out = input(ai, p.yaw || 0);
    out.fireSeq = ai.fireSeq;
    b.gunnerUntil = now + 550;
    send(net, out);
    return true;
  }

  function boardTask(net, ai, b, p, now) {
    if (p.role) {
      tapInteract(net, ai, b, p, now);
      return;
    }
    const walk = moveTo(ai, p, 0, 0);
    if (walk.distance <= 1.3) {
      walk.out.w = false;
      ai.grappleSeq += 1;
      walk.out.grappleSeq = ai.grappleSeq;
      b.boardUntil = now + 1450;
      b.task = null;
    }
    send(net, walk.out);
  }

  function enemyDeck(net, ai, b, state, p, now) {
    if (now < b.boardUntil || p.boardingCompleteAt) {
      send(net, input(ai, p.yaw || 0));
      return;
    }

    const target = human(state);
    if (target?.alive !== false && target?.ship === p.ship) {
      if (target.deck !== p.deck) {
        const hatch = moveTo(ai, p, 0, 3.3);
        if (hatch.distance <= 1.35) {
          hatch.out.w = false;
          tapInteract(net, ai, b, p, now, hatch.out);
        } else send(net, hatch.out);
        return;
      }

      const chase = moveTo(ai, p, target.x, target.z);
      if (chase.distance <= 2.25 && now - b.lastSword > 900) {
        b.lastSword = now;
        ai.swordSeq += 1;
        chase.out.swordSeq = ai.swordSeq;
      }
      if (chase.distance < 1.45) chase.out.w = false;
      send(net, chase.out);
      return;
    }

    if (p.deck === "upper") {
      const hatch = moveTo(ai, p, 0, 3.3);
      if (hatch.distance <= 1.35) {
        hatch.out.w = false;
        tapInteract(net, ai, b, p, now, hatch.out);
      } else send(net, hatch.out);
      return;
    }

    const flag = moveTo(ai, p, 0, -7.5);
    if (flag.distance <= 2) {
      flag.out.w = false;
      flag.out.interactHeld = true;
    }
    send(net, flag.out);
  }

  function think(net) {
    const ai = net.__kdjBotAi;
    const state = ai?.state;
    const b = net.__kdj0201Brain;
    if (!net.__kdjSinglePlayer || !ai || !state || !b) return;

    const p = state.players?.[BOT_ID];
    if (!p) return;
    const now = Date.now();

    if (Number(state.round || 0) !== b.round) {
      b.round = Number(state.round || 0);
      b.task = null;
      b.gunnerUntil = 0;
      b.boardUntil = 0;
      b.lastBoard = 0;
    }

    if (state.phase !== "playing" || !p.spawned || p.alive === false) {
      send(net, input(ai, p.yaw || 0));
      return;
    }

    if (p.ship !== p.team) {
      enemyDeck(net, ai, b, state, p, now);
      return;
    }

    const ship = state.ships[p.team];
    const enemy = state.ships[enemyTeam(p.team)];
    if (!ship || !enemy || ship.destroyed || enemy.destroyed) return;
    const distance = Math.hypot(enemy.x - ship.x, enemy.z - ship.z) || 1;

    if (b.task === "board") {
      boardTask(net, ai, b, p, now);
      return;
    }

    if (p.role === "gunner") {
      if (now < b.gunnerUntil) send(net, input(ai, p.yaw || 0));
      else tapInteract(net, ai, b, p, now);
      return;
    }

    if (b.task === "rigging" || b.task === "returnHelm" || (distance >= 62 && Number(ship.sailTrim ?? 1) < 2)) {
      if (serviceRigging(net, ai, b, p, ship, now)) return;
    }

    if (!ensureHelm(net, ai, b, p, now)) return;

    send(net, steer(ai, ship, pursuitHeading(ship, enemy, distance), distance));
    if (tryFire(net, ai, b, state, p, ship, enemy, now)) return;

    const target = human(state);
    if (distance < 30 && now - b.lastBoard > 7000 &&
        (Number(enemy.mobility || 100) <= 48 || Number(ship.mobility || 100) <= 34 || target?.alive === false)) {
      b.lastBoard = now;
      b.task = "board";
      tapInteract(net, ai, b, p, now);
    }
  }

  Network.prototype.createRoom = async function createRoom0201Controller(name) {
    const room = await previousCreateRoom.call(this, name);
    if (!this.__kdjSinglePlayer || !this.__kdjBotAi) return room;

    this.__kdj0201Brain = brain();
    if (this.__kdjBotAi.timer) clearInterval(this.__kdjBotAi.timer);
    // Occupy the old AI timer slot before its delayed bot injection runs. Its
    // startBotLoop sees a timer already present and therefore never starts.
    this.__kdjBotAi.timer = setInterval(() => think(this), THINK_MS);
    return room;
  };

  Network.prototype.cleanup = function cleanup0201Controller() {
    this.__kdj0201Brain = null;
    return previousCleanup.call(this);
  };
})();
