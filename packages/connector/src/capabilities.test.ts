import assert from "node:assert/strict";
import { test } from "node:test";

import { CONNECTOR_CAPABILITIES, isConnectorCapability } from "./capabilities";
import { CONNECTOR_JOB_DESCRIPTORS, CONNECTOR_LANES, LANE_CONCURRENCY } from "./job-types";
import {
  isLabelPrintFormat,
  labelPrintDocumentPath,
  normalizeLocalPrinters,
  parseLabelPrintJobPayload,
} from "./label-printing";

test("label_printing is a known connector capability", () => {
  assert.ok(CONNECTOR_CAPABILITIES.includes("label_printing"));
  assert.equal(isConnectorCapability("label_printing"), true);
});

test("label print jobs use the printing lane with concurrency 1", () => {
  assert.ok(CONNECTOR_LANES.includes("printing"));
  assert.equal(LANE_CONCURRENCY.printing, 1);
  assert.equal(CONNECTOR_JOB_DESCRIPTORS.label_print.lane, "printing");
  assert.equal(CONNECTOR_JOB_DESCRIPTORS.label_print.capability, "label_printing");
});

test("label print document path is connector-scoped", () => {
  assert.equal(labelPrintDocumentPath("job-123"), "/api/connectors/print-jobs/job-123/document");
});

test("normalizeLocalPrinters deduplicates entries", () => {
  assert.equal(normalizeLocalPrinters([{ id: "p1", name: "A" }, { id: "p1", name: "B" }]).length, 1);
});

test("parseLabelPrintJobPayload requires printer and title", () => {
  assert.equal(parseLabelPrintJobPayload(null), null);
  assert.ok(parseLabelPrintJobPayload({ printerId: "p1", title: "T" }));
  assert.equal(isLabelPrintFormat("pdf"), true);
});
