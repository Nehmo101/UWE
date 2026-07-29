import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveImageProviderConfig, runImageStudioTask } from "./index";

describe("resolveImageProviderConfig", () => {
  it("ist standardmäßig aktiv und nutzt die Connector-Queue", () => {
    const config = resolveImageProviderConfig({});
    assert.equal(config.enabled, true);
    assert.equal(config.useConnectorImage, true);
  });

  it("respektiert RTX_USE_CONNECTOR_IMAGE=false", () => {
    assert.equal(resolveImageProviderConfig({ RTX_USE_CONNECTOR_IMAGE: "false" }).useConnectorImage, false);
  });

  it("respektiert IMAGE_STUDIO_ENABLED=false", () => {
    assert.equal(resolveImageProviderConfig({ IMAGE_STUDIO_ENABLED: "false" }).enabled, false);
  });
});

describe("runImageStudioTask", () => {
  it("ist ohne Connector nicht verfügbar — es gibt keinen Ausweichweg", async () => {
    const result = await runImageStudioTask(
      { task: "generate", prompt: "Ein Waldtempel" },
      { enabled: true, useConnectorImage: true },
    );
    assert.equal(result.success, false);
    assert.equal(result.providerUsed, "disabled");
    assert.match(result.error ?? "", /Maschinenraum/);
  });

  it("reicht den zusammengebauten Prompt an die Connector-Brücke durch", async () => {
    let seen = "";
    const result = await runImageStudioTask(
      {
        task: "generate",
        prompt: "Ein Waldtempel",
        contextMode: "brain_context",
        contextSnippet: "Moos und Nebel",
      },
      {
        enabled: true,
        useConnectorImage: true,
        connectorImageGenerate: async (request) => {
          seen = request.prompt;
          return { success: true, providerUsed: "local_rtx", imageBase64: "x" };
        },
      },
    );
    assert.equal(result.success, true);
    assert.equal(result.providerUsed, "local_rtx");
    // Privater Kontext darf mitgehen: er verlässt den Host nicht.
    assert.match(seen, /\[Kontext: Moos und Nebel\]/);
  });
});
