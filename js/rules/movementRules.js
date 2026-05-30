/* Pure movement rule helpers.
   These are intentionally DOM-free so future multiplayer/server-authoritative
   movement validation can reuse the same jump decisions without browser UI code. */

(function registerMovementRules(global) {
  "use strict";

  function getNode(nodes, nodeId) {
    return nodes?.[nodeId] || null;
  }

  function isValidNode(nodes, nodeId) {
    return Boolean(getNode(nodes, nodeId));
  }

  function getNodeConnections(nodes, nodeId) {
    const node = getNode(nodes, nodeId);
    return Array.isArray(node?.connects) ? node.connects : [];
  }

  function isPlanetNode(nodes, nodeId) {
    const node = getNode(nodes, nodeId);
    return Boolean(node?.planetId || node?.type === "planet");
  }

  function isAdjacentNode(nodes, currentNodeId, targetNodeId) {
    return getNodeConnections(nodes, currentNodeId).includes(targetNodeId);
  }

  function canOpenSectorMap(jumpCharge, jumpMax) {
    return Number(jumpCharge) >= Number(jumpMax);
  }

  function canJumpToNode(nodes, currentNodeId, targetNodeId, jumpCharge, jumpMax) {
    if (targetNodeId === currentNodeId) return false;
    if (!isValidNode(nodes, targetNodeId)) return false;
    if (!isAdjacentNode(nodes, currentNodeId, targetNodeId)) return false;
    return canOpenSectorMap(jumpCharge, jumpMax);
  }

  function getJumpTransition(nodes, currentNodeId, targetNodeId, jumpCharge, jumpMax) {
    const canJump = canJumpToNode(nodes, currentNodeId, targetNodeId, jumpCharge, jumpMax);
    return {
      canJump,
      from: currentNodeId,
      to: targetNodeId,
      isPlanetDestination: canJump && isPlanetNode(nodes, targetNodeId)
    };
  }

  global.LupenMovementRules = Object.freeze({
    getNode,
    isValidNode,
    getNodeConnections,
    isPlanetNode,
    isAdjacentNode,
    canOpenSectorMap,
    canJumpToNode,
    getJumpTransition
  });
})(window);
