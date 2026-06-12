import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isYouTubeUrl,
} from "./youtube";

describe("YouTube URL parser", () => {
  const validCases = [
    {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      id: "dQw4w9WgXcQ",
    },
    {
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest",
      id: "dQw4w9WgXcQ",
    },
    {
      url: "https://youtu.be/dQw4w9WgXcQ",
      id: "dQw4w9WgXcQ",
    },
    {
      url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      id: "dQw4w9WgXcQ",
    },
    {
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      id: "dQw4w9WgXcQ",
    },
    {
      url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      id: "dQw4w9WgXcQ",
    },
  ] as const;

  for (const testCase of validCases) {
    it(`parses valid YouTube URL: ${testCase.url}`, () => {
      assert.equal(extractYouTubeVideoId(testCase.url), testCase.id);
      assert.equal(isYouTubeUrl(testCase.url), true);
      assert.equal(
        getYouTubeThumbnailUrl(testCase.id),
        `https://img.youtube.com/vi/${testCase.id}/hqdefault.jpg`,
      );
    });
  }

  const invalidCases = [
    "",
    "not-a-url",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/playlist?list=PLtest",
    "https://youtu.be/",
  ];

  for (const url of invalidCases) {
    it(`rejects invalid YouTube URL: ${url || "(empty)"}`, () => {
      assert.equal(extractYouTubeVideoId(url), null);
      assert.equal(isYouTubeUrl(url), false);
    });
  }
});
