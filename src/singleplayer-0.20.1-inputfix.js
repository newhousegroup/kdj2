(() => {
  const BOT_ID = "kdj2-local-bot";
  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const previousCreateRoom = Network.prototype.createRoom;
  const previousCleanup = Network.prototype.cleanup;

  Network.prototype.createRoom = async function createRoom0201InputFix(name) {
    const room = await previousCreateRoom.call(this, name);
    if (!this.__kdjSinglePlayer || this.__kdj0201InputWrapped) return room;

    const originalOnPacket = this.callbacks.onPacket;
    this.__kdj0201InputWrapped = true;
    this.__kdj0201OriginalOnPacket = originalOnPacket;

    this.callbacks.onPacket = (from, packet) => {
      if (from === BOT_ID && packet?.type === "input" && packet.input) {
        const fixedInput = { ...packet.input };
        // Final helm simulation: steer=(d-a), then 0.11.3 multiplies forward
        // steering by -1. Human keyboard mapping compensates in 0.17.3; the bot
        // bypasses inputSnapshot(), so swap its A/D fields here as well.
        [fixedInput.a, fixedInput.d] = [fixedInput.d, fixedInput.a];
        return originalOnPacket?.(from, { ...packet, input: fixedInput });
      }
      return originalOnPacket?.(from, packet);
    };

    return room;
  };

  Network.prototype.cleanup = function cleanup0201InputFix() {
    if (this.__kdj0201InputWrapped && this.__kdj0201OriginalOnPacket) {
      this.callbacks.onPacket = this.__kdj0201OriginalOnPacket;
    }
    this.__kdj0201InputWrapped = false;
    this.__kdj0201OriginalOnPacket = null;
    return previousCleanup.call(this);
  };
})();
