"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  extractTurnEndQuestion,
  decideTurnEndQuestionAction,
  TURN_END_QUESTION_AGENTS,
} = require("../src/claude-turn-ask");
const { __test: agy } = require("../hooks/antigravity-hook");

describe("extractTurnEndQuestion", () => {
  it("finds a question on the last line", () => {
    assert.equal(extractTurnEndQuestion("Done.\n\nQuer que eu commite?"), "Quer que eu commite?");
  });
  it("ignores markdown emphasis and closing quotes", () => {
    assert.equal(extractTurnEndQuestion("**Posso seguir?**"), "Posso seguir?");
    assert.equal(extractTurnEndQuestion('Quer "isso"?"'), 'Quer "isso"?');
  });
  it("ignores a question that is not last", () => {
    assert.equal(extractTurnEndQuestion("Posso seguir?\nFeito, tudo pronto."), null);
  });
  it("ignores empty, non-string and code-fence endings", () => {
    assert.equal(extractTurnEndQuestion(""), null);
    assert.equal(extractTurnEndQuestion(null), null);
    assert.equal(extractTurnEndQuestion("x\n```"), null);
  });
});

describe("decideTurnEndQuestionAction", () => {
  it("shows on Stop with a question, clears on Stop without one", () => {
    assert.equal(decideTurnEndQuestionAction({ event: "Stop", assistantLastOutput: "ok?" }), "show");
    assert.equal(decideTurnEndQuestionAction({ event: "Stop", assistantLastOutput: "ok." }), "clear");
  });
  it("clears when the turn moves on and ignores other events", () => {
    for (const event of ["UserPromptSubmit", "PreToolUse", "SessionEnd"]) {
      assert.equal(decideTurnEndQuestionAction({ event }), "clear");
    }
    assert.equal(decideTurnEndQuestionAction({ event: "PostToolUse" }), "ignore");
  });
  it("covers codex and antigravity", () => {
    assert.ok(TURN_END_QUESTION_AGENTS.has("codex") && TURN_END_QUESTION_AGENTS.has("antigravity-cli"));
  });
});

describe("antigravity hook Stop body", () => {
  it("sends the last planner response from the transcript", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-"));
    const file = path.join(dir, "transcript.jsonl");
    fs.writeFileSync(file, [
      JSON.stringify({ type: "PLANNER_RESPONSE", content: "primeiro" }),
      JSON.stringify({ type: "GENERIC", content: "saida" }),
      JSON.stringify({ type: "PLANNER_RESPONSE", content: "Quer continuar?" }),
    ].join("\n"));
    const body = agy.buildStateBody("Stop", { conversationId: "c1", transcriptPath: file }, {});
    assert.equal(body.assistant_last_output, "Quer continuar?");
    assert.equal(agy.buildStateBody("PreToolUse", { conversationId: "c1", transcriptPath: file }, {}).assistant_last_output, undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("tolerates a missing transcript", () => {
    const body = agy.buildStateBody("Stop", { conversationId: "c1", transcriptPath: "/nope/x.jsonl" }, {});
    assert.equal(body.assistant_last_output, undefined);
  });
});

describe("/state route raises the card for Codex and Antigravity", () => {
  const { EventEmitter } = require("node:events");
  const { handleStatePost } = require("../src/server-route-state");

  function harness(overrides = {}) {
    const calls = { shown: [], cleared: [], tracked: [], done: [] };
    const ctx = {
      STATE_SVGS: { idle: "x.svg", thinking: "x.svg", working: "x.svg", attention: "x.svg", error: "x.svg", notification: "x.svg", sleeping: "x.svg" },
      pendingPermissions: [], sessions: new Map(),
      isAgentEnabled: () => true, setState() {}, updateSession: () => true, updateAccountQuota() {},
      resolvePermissionEntry() {}, permLog() {}, handleTestResult() {},
      showClaudeTurnAskBubble: (p) => { calls.shown.push(p); return true; },
      clearClaudeTurnAskBubbles: (...a) => calls.cleared.push(a),
      trackClaudeTurnAskReminder: (p) => calls.tracked.push(p),
      resolveClaudeTurnAskReminder() {},
      showTaskDoneBubble: (c) => { calls.done.push(c); return true; },
      ...overrides,
    };
    const recorder = { acceptedUnlessDnd() {}, droppedByDisabled() {}, droppedByDnd() {}, droppedInvalidAgent() {}, droppedUnsupported() {} };
    const post = (body) => new Promise((resolve) => {
      const req = new EventEmitter(); req.headers = {};
      setImmediate(() => { req.emit("data", Buffer.from(JSON.stringify(body))); req.emit("end"); });
      const res = { writeHead(c) { this.statusCode = c; }, end() { resolve(this); } };
      handleStatePost(req, res, { ctx, createRequestHookRecorder: () => recorder, shouldDropForDnd: () => false, codexOfficialTurns: new Map() });
    });
    return { calls, post };
  }

  it("antigravity: Stop ending in a question shows the card with its agent; next prompt clears it", async () => {
    const { calls, post } = harness();
    await post({ state: "attention", event: "Stop", session_id: "antigravity:c1", agent_id: "antigravity-cli",
      assistant_last_output: "Pronto.\nQuer que eu rode os testes?" });
    assert.equal(calls.shown.length, 1);
    assert.equal(calls.shown[0].agentId, "antigravity-cli");
    assert.equal(calls.shown[0].ask, "Quer que eu rode os testes?");
    assert.equal(calls.tracked.length, 1);
    const before = calls.cleared.length;
    await post({ state: "thinking", event: "UserPromptSubmit", session_id: "antigravity:c1", agent_id: "antigravity-cli" });
    assert.equal(calls.cleared.length, before + 1);
  });

  it("codex: a plain final answer raises the task-done card, not the question card", async () => {
    const { calls, post } = harness();
    await post({ state: "attention", event: "Stop", session_id: "codex:t1", agent_id: "codex", hook_source: "codex-official",
      assistant_last_output: "Tudo pronto." });
    assert.equal(calls.shown.length, 0);
    assert.equal(calls.done.length, 1);
    assert.equal(calls.done[0].agentId, "codex");
    assert.equal(calls.done[0].text, "Tudo pronto.");
  });

  it("antigravity: a Stop without a question raises the task-done card; a question does not", async () => {
    const { calls, post } = harness();
    await post({ state: "attention", event: "Stop", session_id: "antigravity:c2", agent_id: "antigravity-cli",
      assistant_last_output: "Corrigi o bug." });
    await post({ state: "attention", event: "Stop", session_id: "antigravity:c3", agent_id: "antigravity-cli",
      assistant_last_output: "Posso seguir?" });
    assert.deepEqual(calls.done.map((c) => c.text), ["Corrigi o bug."]);
  });

  it("codex: Stop ending in a question shows the card", async () => {
    const { calls, post } = harness();
    await post({ state: "attention", event: "Stop", session_id: "codex:t2", agent_id: "codex", hook_source: "codex-official",
      assistant_last_output: "Quer que eu continue?" });
    assert.equal(calls.shown.length, 1);
    assert.equal(calls.shown[0].agentId, "codex");
  });
  it("isolates Codex cards across rollout profiles and keeps the child Stop silent", async () => {
    const { codexProfileIdentity, normalizeCodexProfileConfig } = require("../src/codex-profiles");
    const home = path.join(os.tmpdir(), "clawd-card-profiles");
    const companyHome = path.join(home, "company-codex");
    const profiles = normalizeCodexProfileConfig({
      profiles: [{ id: "company", label: "Company", home: companyHome }],
    }, { home, env: {} });
    const rawId = "codex:shared-thread";
    const personalId = codexProfileIdentity(rawId, profiles[0]).sessionId;
    const companyId = codexProfileIdentity(rawId, profiles[1]).sessionId;
    const childId = codexProfileIdentity("codex:child-thread", profiles[1]).sessionId;
    const updates = [];
    const { calls, post } = harness({
      getCodexProfiles: () => profiles,
      codexSubagentClassifier: {
        registerSession: (id) => id === childId ? "subagent" : "interactive",
      },
      updateSession: (id, state) => { updates.push([id, state]); return true; },
    });
    const stop = {
      state: "attention", event: "Stop", session_id: rawId, agent_id: "codex",
      hook_source: "codex-official", assistant_last_output: "Quer continuar?",
    };
    const transcript_path = path.join(companyHome, "sessions", "rollout.jsonl");
    assert.equal((await post(stop)).statusCode, 200);
    assert.equal((await post({ ...stop, transcript_path })).statusCode, 200);
    assert.equal((await post({ ...stop, session_id: "codex:child-thread", transcript_path })).statusCode, 200);
    assert.equal((await post({ ...stop, transcript_path, assistant_last_output: "Concluído." })).statusCode, 200);
    assert.deepEqual(calls.shown.map((card) => card.sessionId), [personalId, companyId]);
    assert.deepEqual(calls.done.map((card) => card.sessionId), [companyId]);
    assert.deepEqual(updates, [
      [personalId, "attention"], [companyId, "attention"],
      [childId, "idle"], [companyId, "attention"],
    ]);
  });

  it("keeps rejected Codex updates from creating cards", async () => {
    const { calls, post } = harness({ updateSession: () => false });
    assert.equal((await post({
      state: "attention", event: "Stop", session_id: "codex:stale", agent_id: "codex",
      hook_source: "codex-official", assistant_last_output: "Quer continuar?",
    })).statusCode, 200);
    assert.deepEqual(calls.shown, []);
    assert.deepEqual(calls.done, []);
  });

});
