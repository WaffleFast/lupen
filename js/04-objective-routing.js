/* Shared objective route ownership.
   Trade and Bounty keep their own state and progress; this module only maps
   the active objective onto the shared sector graph and map highlights. */

function findSectorRoute(start, destination) {
  if (!sectorNodes[start] || !sectorNodes[destination]) return [];
  if (start === destination) return [start];

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const nodeName = path[path.length - 1];
    const links = sectorNodes[nodeName]?.connects || [];

    for (const link of links) {
      if (visited.has(link)) continue;
      const nextPath = path.concat(link);
      if (link === destination) return nextPath;
      visited.add(link);
      queue.push(nextPath);
    }
  }

  return [];
}

function getObjectiveRoutePath(objective = getActiveObjective()) {
  if (!objective) return [];
  if (objective.type === "trade") {
    const target = getTradeObjectiveTargetNode(objective);
    return target ? findSectorRoute(currentNode, target) : [];
  }
  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim") {
      const claimPlanet = getNearestPlanetNode(currentNode);
      return findSectorRoute(currentNode, claimPlanet);
    }
    const targetNode = getNearestActiveBountyBotNode(currentNode) || getNearestBountyAreaNode(currentNode, objective.targetArea);
    return targetNode ? findSectorRoute(currentNode, targetNode) : [];
  }
  return [];
}

function isNodeOnActiveTradeRoute(name) {
  const objective = getActiveObjective();
  if (objective?.type === "bounty" && isNodeInBountyArea(name, objective.targetArea)) return true;
  if (objective?.type === "trade" && getTradeObjectiveTargetNode(objective) === name) return true;
  const stagingPath = !objective ? getMultiplayerStagingBountyRoutePath() : [];
  return getObjectiveRoutePath(objective).includes(name) || stagingPath.includes(name);
}

function isLineOnActiveTradeRoute(a, b) {
  const path = getObjectiveRoutePath();
  const stagingPath = !getActiveObjective() ? getMultiplayerStagingBountyRoutePath() : [];
  const combinedPaths = [path, stagingPath].filter((entry) => entry.length > 1);
  for (const candidatePath of combinedPaths) {
    for (let i = 0; i < candidatePath.length - 1; i += 1) {
      if ((candidatePath[i] === a && candidatePath[i + 1] === b) || (candidatePath[i] === b && candidatePath[i + 1] === a)) return true;
    }
  }
  return false;
}
