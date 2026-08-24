(() => {
  const proto = window.KDJNetwork?.prototype;
  if (!proto) return;

  // 0.19.8 could call watchRoute before PeerJS had attached the underlying
  // RTCPeerConnection. In that case the function returned permanently and the
  // recipient status dot stayed yellow even after a DIRECT/TURN route existed.
  proto.watchRoute = function watchRoute0199(conn, attempt = 0) {
    if (!conn) return;

    const pc = conn.peerConnection;
    if (!pc) {
      if (attempt < 16) {
        setTimeout(() => this.watchRoute(conn, attempt + 1), 75);
      }
      return;
    }

    if (conn.__kdjRouteWatcher0199) return;
    conn.__kdjRouteWatcher0199 = true;

    const update = async () => {
      if (pc.iceConnectionState === "failed") {
        this.status("Connection failure", "failure");
        return;
      }
      if (!["connected", "completed"].includes(pc.iceConnectionState)) return;

      try {
        const stats = await pc.getStats();
        let pair = null;

        stats.forEach((report) => {
          if (!pair && report.type === "transport" && report.selectedCandidatePairId) {
            pair = stats.get(report.selectedCandidatePairId);
          }
        });

        if (!pair) {
          stats.forEach((report) => {
            if (
              !pair &&
              report.type === "candidate-pair" &&
              report.state === "succeeded" &&
              (report.selected || report.nominated)
            ) {
              pair = report;
            }
          });
        }

        // Some browsers populate the selected pair a fraction later than the
        // connection state. Leave the dot yellow and retry instead of falsely
        // labelling an unknown route as direct.
        if (!pair) return;

        const local = pair.localCandidateId ? stats.get(pair.localCandidateId) : null;
        const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : null;
        const relay = local?.candidateType === "relay" || remote?.candidateType === "relay";
        this.status(relay ? "TURN relay" : "Direct connection", relay ? "turn" : "direct");
      } catch (_) {
        // Keep the existing neutral status if the browser does not expose enough
        // WebRTC stats to classify the route.
      }
    };

    pc.addEventListener?.("iceconnectionstatechange", update);

    // The route may already be established before this listener is installed.
    // Probe immediately and a few more times while selected-candidate stats settle.
    update();
    setTimeout(update, 150);
    setTimeout(update, 500);
    setTimeout(update, 1200);
  };
})();
