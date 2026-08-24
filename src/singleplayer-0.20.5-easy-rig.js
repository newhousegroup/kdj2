(() => {
  const BOT_ID = "kdj2-local-bot";
  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const previousCreateRoom = Network.prototype.createRoom;
  const previousCleanup = Network.prototype.cleanup;
  const nativeSetInterval = window.setInterval.bind(window);
  let intervalTarget = null;

  // The 0.20.1 controller installs its 100 ms think-loop after createRoom returns.
  // Wrap that one interval so Easy can occasionally *ignore* Cruising without
  // changing the real authoritative sail state. Reefed is never masked.
  window.setInterval = function kdj0205SetInterval(callback, delay, ...args) {
    if (intervalTarget && Number(delay) === 100 && typeof callback === "function") {
      const network = intervalTarget;
      intervalTarget = null;
      const wrapped = (...callbackArgs) => {
        if (!network.__kdjSinglePlayer || window.__KDJ_BOT_DIFFICULTY__ !== "easy") {
          return callback(...callbackArgs);
        }

        const ai = network.__kdjBotAi;
        const state = ai?.state;
        const bot = state?.players?.[BOT_ID];
        const ship = bot ? state?.ships?.[bot.team] : null;
        if (!ship) return callback(...callbackArgs);

        const memory = network.__kdj0205RigMemory || (network.__kdj0205RigMemory = {
          lastTrim: null,
          forgetCruising: null
        });
        const realTrim = Number(ship.sailTrim ?? 1);

        if (realTrim === 2) {
          memory.forgetCruising = null;
        } else if (realTrim === 1 && memory.lastTrim !== 1) {
          // One coin-flip per arrival at Cruising. If James forgets, he stays on
          // the helm until the normal auto-reef reaches Reefed.
          memory.forgetCruising = Math.random() < 0.5;
        } else if (realTrim === 0) {
          // Reefed always wins over forgetfulness: the existing controller sees
          // the real 0 and immediately begins its normal walk-to-rigging routine.
          memory.forgetCruising = false;
        }

        memory.lastTrim = realTrim;

        if (realTrim === 1 && memory.forgetCruising === true) {
          ship.sailTrim = 2;
          try {
            return callback(...callbackArgs);
          } finally {
            // Only restore if the controller left our temporary view untouched.
            if (ship.sailTrim === 2) ship.sailTrim = 1;
          }
        }

        return callback(...callbackArgs);
      };
      return nativeSetInterval(wrapped, delay, ...args);
    }
    return nativeSetInterval(callback, delay, ...args);
  };

  Network.prototype.createRoom = async function createRoom0205EasyRig(name) {
    const room = await previousCreateRoom.call(this, name);
    if (this.__kdjSinglePlayer && window.__KDJ_BOT_DIFFICULTY__ === "easy") {
      this.__kdj0205RigMemory = { lastTrim: null, forgetCruising: null };
      intervalTarget = this;
    }
    return room;
  };

  Network.prototype.cleanup = function cleanup0205EasyRig() {
    if (intervalTarget === this) intervalTarget = null;
    this.__kdj0205RigMemory = null;
    return previousCleanup.call(this);
  };
})();