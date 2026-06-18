// src/deus/types.ts
var DeusMachinaError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DeusMachinaError";
  }
  code;
};

// src/deus/utility.ts
function finite(value, code, label) {
  if (!Number.isFinite(value)) throw new DeusMachinaError(code, `${label} must be finite`);
  return value;
}
function judgeUtility(context, candidates, options = {}) {
  if (options.hysteresis !== void 0 && (!Number.isFinite(options.hysteresis) || options.hysteresis < 0)) {
    throw new DeusMachinaError("InvalidHysteresis", "hysteresis must be finite and >= 0");
  }
  const results = candidates.map((candidate, index) => {
    const eligible = candidate.when?.(context) ?? true;
    const score = eligible ? finite(
      typeof candidate.score === "function" ? candidate.score(context) : candidate.score,
      "InvalidUtilityScore",
      `utility score for ${candidate.key}`
    ) : 0;
    const reason = typeof candidate.reason === "function" ? candidate.reason(context) : candidate.reason;
    return {
      key: candidate.key,
      eligible,
      score,
      index,
      ...reason !== void 0 ? { reason } : null
    };
  });
  let selected = results.filter((r) => r.eligible).reduce(
    (best, r) => best === null || r.score > best.score ? r : best,
    null
  );
  if (selected && options.previousKey !== void 0 && options.hysteresis !== void 0) {
    const previous = results.find((r) => r.key === options.previousKey && r.eligible);
    if (previous && selected.key !== previous.key && selected.score - previous.score < options.hysteresis)
      selected = previous;
  }
  return { selected, candidates: results };
}

// src/deus/machine.ts
function formatDeusPath(path) {
  return path.join("/");
}
function sameDeusPath(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function isDeusAncestorPath(ancestor, path) {
  return ancestor.length <= path.length && ancestor.every((v, i) => v === path[i]);
}
function finite2(value, key) {
  if (!Number.isFinite(value))
    throw new DeusMachinaError("InvalidUtilityScore", `${key} score must be finite`);
  return value;
}
function pathKey(path) {
  return formatDeusPath(path);
}
function defineDeusMachine(machine) {
  const stateKeys = /* @__PURE__ */ new Set();
  const states = machine.states.map((s) => {
    if (s.path.length === 0)
      throw new DeusMachinaError("InvalidStatePath", "state paths must be non-empty");
    const key = pathKey(s.path);
    if (stateKeys.has(key))
      throw new DeusMachinaError("DuplicateStatePath", `duplicate state path ${key}`);
    stateKeys.add(key);
    return { ...s, path: [...s.path] };
  });
  if (!stateKeys.has(pathKey(machine.initial)))
    throw new DeusMachinaError("InvalidInitialState", "initial path must exist");
  const transitionKeys = /* @__PURE__ */ new Set();
  const transitions = machine.transitions.map((t) => {
    if (!t.key)
      throw new DeusMachinaError("InvalidTransitionKey", "transition keys must be non-empty");
    if (transitionKeys.has(t.key))
      throw new DeusMachinaError("DuplicateTransitionKey", `duplicate transition key ${t.key}`);
    transitionKeys.add(t.key);
    if (!stateKeys.has(pathKey(t.from)))
      throw new DeusMachinaError(
        "InvalidTransitionFrom",
        `transition ${t.key} from path must exist`
      );
    if (Array.isArray(t.to) && !stateKeys.has(pathKey(t.to)))
      throw new DeusMachinaError("InvalidTransitionTo", `transition ${t.key} to path must exist`);
    return { ...t, from: [...t.from], to: Array.isArray(t.to) ? [...t.to] : t.to };
  });
  return { initial: [...machine.initial], states, transitions };
}
function createDeusSnapshot(machine, board) {
  return { state: [...machine.initial], board, stepIndex: 0 };
}
function stepDeusMachine(machine, snapshot, event) {
  const stateBefore = [...snapshot.state];
  const stateMap = new Map(machine.states.map((s) => [pathKey(s.path), s]));
  const orderedFrom = stateBefore.map((_, i) => stateBefore.slice(0, stateBefore.length - i));
  const candidates = orderedFrom.flatMap(
    (from) => machine.transitions.map((t, authorIndex) => ({ t, authorIndex })).filter(({ t }) => sameDeusPath(t.from, from))
  );
  const traces = [];
  let selected;
  candidates.forEach(({ t }, index) => {
    const eventMatches = t.event === void 0 || t.event === event.type;
    let eligible = eventMatches && (t.when?.(snapshot.board, event) ?? true);
    let utility;
    let utilityKey;
    let score = eligible ? t.score === void 0 ? 1 : finite2(typeof t.score === "function" ? t.score(snapshot.board, event) : t.score, t.key) : 0;
    if (eligible && t.utility) {
      utility = judgeUtility(
        { board: snapshot.board, event },
        t.utility.map((u) => ({
          key: u.key,
          when: (ctx) => u.when?.(ctx.board, ctx.event) ?? true,
          score: (ctx) => typeof u.score === "function" ? u.score(ctx.board, ctx.event) : u.score,
          reason: typeof u.reason === "function" ? (ctx) => {
            const reason2 = u.reason;
            return typeof reason2 === "function" ? reason2(ctx.board, ctx.event) : "";
          } : u.reason
        })),
        t.hysteresis ? { previousKey: t.hysteresis.previous(snapshot.board), hysteresis: t.hysteresis.margin } : void 0
      );
      if (!utility.selected) eligible = false;
      else {
        utilityKey = utility.selected.key;
        if (t.score === void 0) score = utility.selected.score;
      }
    }
    const to = eligible && t.to ? typeof t.to === "function" ? [...t.to(snapshot.board, event)] : [...t.to] : void 0;
    const reason = typeof t.reason === "function" ? t.reason(snapshot.board, event) : t.reason;
    const trace = {
      key: t.key,
      from: [...t.from],
      ...to ? { to } : null,
      event: t.event,
      eligible,
      score: eligible ? score : 0,
      index,
      ...reason !== void 0 ? { reason } : null,
      ...utility ? { utility } : null
    };
    traces.push(trace);
    if (eligible && (!selected || trace.score > selected.trace.score))
      selected = { trace, t, utilityKey };
  });
  if (!selected)
    return {
      snapshot: { state: stateBefore, board: snapshot.board, stepIndex: snapshot.stepIndex + 1 },
      trace: { stateBefore, stateAfter: stateBefore, event: event.type, transitions: traces }
    };
  const target = selected.trace.to ?? stateBefore;
  const common = stateBefore.findIndex((v, i) => target[i] !== v);
  const prefix = common === -1 ? Math.min(stateBefore.length, target.length) : common;
  for (let i = stateBefore.length; i > prefix; i--)
    stateMap.get(pathKey(stateBefore.slice(0, i)))?.onExit?.(snapshot.board, event);
  if (selected.utilityKey)
    selected.t.utility?.find((u) => u.key === selected?.utilityKey)?.do?.(snapshot.board, event);
  selected.t.do?.(snapshot.board, event);
  for (let i = prefix + 1; i <= target.length; i++)
    stateMap.get(pathKey(target.slice(0, i)))?.onEnter?.(snapshot.board, event);
  return {
    snapshot: { state: [...target], board: snapshot.board, stepIndex: snapshot.stepIndex + 1 },
    trace: {
      stateBefore,
      stateAfter: [...target],
      event: event.type,
      selectedTransition: selected.trace,
      transitions: traces
    }
  };
}

// src/deus/debugOverlay.ts
var collapsed = ["debugOverlay", "collapsed"];
var overlay = ["debugOverlay", "nonInteractiveOverlay"];
var panel = ["debugOverlay", "interactivePanel"];
function createMachinaDebugOverlayMachine() {
  return defineDeusMachine({
    initial: collapsed,
    states: [
      {
        path: collapsed,
        onEnter: (b) => {
          b.mode = "collapsed";
          b.selectedNodeId = void 0;
        }
      },
      {
        path: overlay,
        onEnter: (b) => {
          b.mode = "nonInteractiveOverlay";
        }
      },
      {
        path: panel,
        onEnter: (b) => {
          b.mode = "interactivePanel";
        }
      }
    ],
    transitions: [
      { key: "collapsed.showOverlay", from: collapsed, event: "showOverlay", to: overlay },
      {
        key: "overlay.openPanel",
        from: overlay,
        event: "openPanel",
        to: panel,
        do: (b, e) => {
          if (e.type === "openPanel") b.selectedNodeId = e.nodeId;
        }
      },
      { key: "panel.showOverlay", from: panel, event: "showOverlay", to: overlay },
      { key: "overlay.collapse", from: overlay, event: "collapse", to: collapsed },
      { key: "panel.collapse", from: panel, event: "collapse", to: collapsed },
      {
        key: "overlay.toggleLabels",
        from: overlay,
        event: "toggleLabels",
        do: (b) => {
          b.labels = !b.labels;
        }
      },
      {
        key: "panel.toggleLabels",
        from: panel,
        event: "toggleLabels",
        do: (b) => {
          b.labels = !b.labels;
        }
      },
      {
        key: "overlay.toggleBorders",
        from: overlay,
        event: "toggleBorders",
        do: (b) => {
          b.borders = !b.borders;
        }
      },
      {
        key: "panel.toggleBorders",
        from: panel,
        event: "toggleBorders",
        do: (b) => {
          b.borders = !b.borders;
        }
      },
      {
        key: "panel.selectNode",
        from: panel,
        event: "selectNode",
        do: (b, e) => {
          if (e.type === "selectNode") b.selectedNodeId = e.nodeId;
        }
      }
    ]
  });
}
function getMachinaDebugOverlayBehavior(board) {
  if (board.mode === "collapsed")
    return {
      visible: false,
      pointerEvents: "none",
      consumesLayoutSpace: false,
      showPanel: false,
      showLabels: false,
      showBorders: false
    };
  if (board.mode === "nonInteractiveOverlay")
    return {
      visible: true,
      pointerEvents: "none",
      consumesLayoutSpace: false,
      showPanel: false,
      showLabels: board.labels,
      showBorders: board.borders
    };
  return {
    visible: true,
    pointerEvents: "auto",
    consumesLayoutSpace: true,
    showPanel: true,
    showLabels: board.labels,
    showBorders: board.borders
  };
}

export {
  DeusMachinaError,
  judgeUtility,
  formatDeusPath,
  sameDeusPath,
  isDeusAncestorPath,
  defineDeusMachine,
  createDeusSnapshot,
  stepDeusMachine,
  createMachinaDebugOverlayMachine,
  getMachinaDebugOverlayBehavior
};
