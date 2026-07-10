"use client";

import { useState } from "react";
import { extractVariables } from "@uwe/database/prompt-library-utils";
import { PromptBodyEditor } from "./PromptBodyEditor";

interface Props {
  initialBody: string;
  initialVariables: string[];
}

export function PromptBodyField({ initialBody, initialVariables }: Props) {
  const [body, setBody] = useState(initialBody);
  const variables =
    initialVariables.length > 0 ? initialVariables : extractVariables(body);

  return (
    <>
      <PromptBodyEditor body={body} variables={variables} />
      <label>
        Body bearbeiten
        <textarea
          name="body"
          rows={8}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          style={{ fontFamily: "monospace" }}
        />
      </label>
    </>
  );
}
