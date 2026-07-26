import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestBrainClient, type BrainPrismaClient } from "@uwe/database/test-helpers";
import {
  createBrainAssistantService,
  deriveConversationTitle,
} from "./conversation-service";

describe("BrainAssistantService (integration)", () => {
  let brainDb: BrainPrismaClient;

  before(() => {
    brainDb = createTestBrainClient();
  });

  after(async () => {
    await brainDb.$disconnect();
  });

  it("stores the assigned AI and reads it back", async () => {
    const service = createBrainAssistantService(brainDb);

    assert.deepEqual(await service.getProfile(), {
      chat: null,
      vision: null,
      sttModelName: null,
      systemPrompt: "",
      defaultContextMode: "plain",
    });

    await service.saveProfile({
      chat: { connectorId: "con-1", modelId: "ollama:qwen2.5", label: "Qwen 2.5" },
      vision: { connectorId: "con-1", modelId: "ollama:llava", label: "LLaVA" },
      sttModelName: "large-v3-turbo",
      systemPrompt: "Sei knapp.",
      defaultContextMode: "life_brain",
    });

    const profile = await service.getProfile();
    assert.deepEqual(profile.chat, {
      connectorId: "con-1",
      modelId: "ollama:qwen2.5",
      label: "Qwen 2.5",
    });
    assert.equal(profile.vision?.label, "LLaVA");
    assert.equal(profile.sttModelName, "large-v3-turbo");
    assert.equal(profile.defaultContextMode, "life_brain");

    // Saving is an upsert — clearing a slot must actually clear it.
    await service.saveProfile({
      chat: null,
      vision: null,
      sttModelName: null,
      systemPrompt: "",
      defaultContextMode: "plain",
    });
    assert.equal((await service.getProfile()).chat, null);
  });

  it("runs a full conversation lifecycle and cascades on delete", async () => {
    const service = createBrainAssistantService(brainDb);
    const conversationId = await service.createConversation();

    const attachment = await service.createAttachment({
      conversationId,
      kind: "image",
      storageKey: `${conversationId}/bild.jpg`,
      mimeType: "image/jpeg",
      originalFilename: "bild.jpg",
      sizeBytes: 2048,
    });

    // Uploaded before the message exists — the conversation owns it meanwhile.
    const pending = await service.listPendingAttachments(conversationId, [attachment.id]);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].storageKey, `${conversationId}/bild.jpg`);

    const userMessage = await service.appendMessage({
      conversationId,
      role: "user",
      content: "Was ist auf dem Bild?",
      attachmentIds: [attachment.id],
    });
    assert.equal(userMessage.attachments.length, 1);

    await service.appendMessage({
      conversationId,
      role: "assistant",
      content: "Ein Regal.",
      model: "llava",
      route: "vision+llm",
      durationMs: 1234,
    });

    const conversation = await service.getConversation(conversationId);
    assert.ok(conversation);
    assert.equal(conversation.messages.length, 2);
    assert.equal(conversation.messageCount, 2);
    assert.equal(conversation.messages[1].model, "llava");
    assert.equal(conversation.messages[0].attachments[0].originalFilename, "bild.jpg");

    await service.setAttachmentText(attachment.id, "Ein Regal mit Spulen.", "job-1");
    const refreshed = await service.getConversation(conversationId);
    assert.equal(refreshed?.messages[0].attachments[0].extractedText, "Ein Regal mit Spulen.");

    assert.deepEqual(await service.listStorageKeysForConversation(conversationId), [
      `${conversationId}/bild.jpg`,
    ]);

    await service.deleteConversation(conversationId);
    assert.equal(await service.getConversation(conversationId), null);
    assert.equal(
      await brainDb.brainChatMessage.count({ where: { conversationId } }),
      0,
      "messages must cascade",
    );
    assert.equal(
      await brainDb.brainChatAttachment.count({ where: { conversationId } }),
      0,
      "attachments must cascade",
    );
  });

  it("refuses attachments from a different conversation", async () => {
    const service = createBrainAssistantService(brainDb);
    const mine = await service.createConversation({ title: "Meins" });
    const other = await service.createConversation({ title: "Anderes" });

    const foreign = await service.createAttachment({
      conversationId: other,
      kind: "document",
      storageKey: `${other}/fremd.pdf`,
      mimeType: "application/pdf",
      originalFilename: "fremd.pdf",
      sizeBytes: 10,
    });

    assert.deepEqual(await service.listPendingAttachments(mine, [foreign.id]), []);

    const message = await service.appendMessage({
      conversationId: mine,
      role: "user",
      content: "Frage",
      attachmentIds: [foreign.id],
    });
    assert.equal(message.attachments.length, 0);
  });

  it("orders the conversation list by most recent activity", async () => {
    const service = createBrainAssistantService(brainDb);
    const older = await service.createConversation({ title: "Älter" });
    const newer = await service.createConversation({ title: "Neuer" });

    await service.appendMessage({ conversationId: older, role: "user", content: "Hallo" });

    const list = await service.listConversations();
    const olderAt = list.findIndex((entry) => entry.id === older);
    const newerAt = list.findIndex((entry) => entry.id === newer);
    assert.ok(olderAt < newerAt, "the conversation with the newest message comes first");
  });

  it("keeps per-conversation model overrides and context mode", async () => {
    const service = createBrainAssistantService(brainDb);
    const id = await service.createConversation();

    await service.setConversationModel(id, {
      connectorId: "con-2",
      modelId: "ollama:mistral",
      label: "Mistral",
    });
    await service.setContextMode(id, "life_brain");

    const conversation = await service.getConversation(id);
    assert.equal(conversation?.connectorId, "con-2");
    assert.equal(conversation?.modelLabel, "Mistral");
    assert.equal(conversation?.contextMode, "life_brain");

    await service.setConversationModel(id, null);
    assert.equal((await service.getConversation(id))?.modelId, null);
  });
});

describe("deriveConversationTitle", () => {
  it("uses the question, collapsed to one line", () => {
    assert.equal(deriveConversationTitle("  Was\n steht  heute an? "), "Was steht heute an?");
  });

  it("shortens a long question", () => {
    const title = deriveConversationTitle("x".repeat(200));
    assert.ok(title.length <= 60);
    assert.match(title, /…$/);
  });

  it("falls back for empty input", () => {
    assert.equal(deriveConversationTitle("   "), "Neues Gespräch");
  });
});
