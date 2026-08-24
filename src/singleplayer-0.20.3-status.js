(() => {
  const Network = window.KDJNetwork;
  if (!Network?.prototype) return;

  const originalStatus = Network.prototype.status;

  Network.prototype.status = function status0203(text, kind = "ready") {
    const resolvedKind = this.__kdjSinglePlayer ? "singleplayer" : kind;
    return originalStatus.call(this, text, resolvedKind);
  };
})();
