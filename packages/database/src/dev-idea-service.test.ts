import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createDevIdeaService, parseDevIdeaTranscript } from "./dev-idea-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("DevIdeaService", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates an idea with default status in_planning", async () => {
    const service = createDevIdeaService(db);
    const idea = await service.createIdea({ title: "  Dark Mode  ", body: "Portal dark mode" });

    assert.equal(idea.title, "Dark Mode");
    assert.equal(idea.body, "Portal dark mode");
    assert.equal(idea.status, "in_planning");
    assert.equal(idea.generatedPrompt, null);
    assert.equal(idea.devAgentJobId, null);

    await service.deleteIdea(idea.id);
  });

  it("rejects an empty title", async () => {
    const service = createDevIdeaService(db);
    await assert.rejects(() => service.createIdea({ title: "   " }), /Titel/);
  });

  it("updates fields, status, prompt and agent-job link", async () => {
    const service = createDevIdeaService(db);
    const idea = await service.createIdea({ title: "Feature X" });

    const updated = await service.updateIdea(idea.id, { title: "Feature Y", body: "details" });
    assert.equal(updated.title, "Feature Y");
    assert.equal(updated.body, "details");

    const statusChanged = await service.updateStatus(idea.id, "implemented");
    assert.equal(statusChanged.status, "implemented");

    const withPrompt = await service.setGeneratedPrompt(idea.id, "Implement Feature Y");
    assert.equal(withPrompt.generatedPrompt, "Implement Feature Y");

    const linked = await service.linkAgentJob(idea.id, "job_123");
    assert.equal(linked.devAgentJobId, "job_123");

    await service.deleteIdea(idea.id);
  });

  it("appends chat messages and persists an ordered transcript", async () => {
    const service = createDevIdeaService(db);
    const idea = await service.createIdea({ title: "Chat idea" });

    await service.appendChatMessages(idea.id, [
      { role: "user", content: "Idee: Tagging", createdAt: new Date().toISOString() },
      { role: "assistant", content: "Welche Felder?", createdAt: new Date().toISOString(), via: "cloud" },
    ]);
    const { transcript } = await service.appendChatMessages(idea.id, [
      { role: "user", content: "Nur Titel", createdAt: new Date().toISOString() },
    ]);

    assert.equal(transcript.length, 3);
    assert.equal(transcript[0]?.role, "user");
    assert.equal(transcript[1]?.role, "assistant");
    assert.equal(transcript[1]?.via, "cloud");
    assert.equal(transcript[2]?.content, "Nur Titel");

    const reloaded = await service.getTranscript(idea.id);
    assert.equal(reloaded.length, 3);

    await service.deleteIdea(idea.id);
  });

  it("lists ideas filtered by status, newest first", async () => {
    const service = createDevIdeaService(db);
    const a = await service.createIdea({ title: "A", status: "rejected" });
    const b = await service.createIdea({ title: "B", status: "rejected" });

    const rejected = await service.listIdeas({ status: "rejected" });
    const ids = rejected.map((idea) => idea.id);
    assert.ok(ids.includes(a.id));
    assert.ok(ids.includes(b.id));
    // newest (b) should come before a
    assert.ok(ids.indexOf(b.id) < ids.indexOf(a.id));

    await service.deleteIdea(a.id);
    await service.deleteIdea(b.id);
  });
});

describe("parseDevIdeaTranscript", () => {
  it("returns [] for non-array / malformed input", () => {
    assert.deepEqual(parseDevIdeaTranscript(null), []);
    assert.deepEqual(parseDevIdeaTranscript("nope"), []);
    assert.deepEqual(parseDevIdeaTranscript([{ role: "system", content: "x" }]), []);
    assert.deepEqual(parseDevIdeaTranscript([{ role: "user" }]), []);
  });

  it("keeps valid messages and drops invalid ones", () => {
    const parsed = parseDevIdeaTranscript([
      { role: "user", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" },
      { role: "bogus", content: "drop me" },
      { role: "assistant", content: "yo", createdAt: "2026-01-01T00:01:00.000Z", via: "local_rtx" },
    ]);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.content, "hi");
    assert.equal(parsed[1]?.via, "local_rtx");
  });
});
