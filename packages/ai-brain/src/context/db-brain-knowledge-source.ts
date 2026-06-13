import type { BrainStoreService } from "@uwe/database/server";
import type { BrainKnowledgeEntry, BrainKnowledgeQuery, BrainKnowledgeSource } from "./brain-knowledge-source";

function taskRelevantDocumentTypes(taskType: string): string[] | undefined {
  switch (taskType) {
    case "prepare_canon_check":
    case "detect_contradictions":
      return ["canon_facts", "world_knowledge", "campaign_knowledge"];
    case "summarize_session":
    case "generate_player_recap":
    case "prepare_mail_draft":
      return ["session_summary", "campaign_knowledge"];
    case "prepare_next_session":
    case "find_open_threads":
      return ["session_summary", "campaign_knowledge", "canon_facts"];
    default:
      return undefined;
  }
}

function taskRelevantFactTypes(taskType: string): string[] | undefined {
  switch (taskType) {
    case "prepare_canon_check":
    case "detect_contradictions":
      return ["canon", "plot_thread"];
    case "prepare_next_session":
    case "find_open_threads":
      return ["plot_thread", "decision", "canon"];
    default:
      return undefined;
  }
}

export function createDbBrainKnowledgeSource(
  brainStore: BrainStoreService,
  worldSlug: string,
): BrainKnowledgeSource {
  return {
    async findRelevant(query: BrainKnowledgeQuery): Promise<BrainKnowledgeEntry[]> {
      const maxEntries = query.maxEntries ?? 20;
      const accessContext = query.allowDmOnly ? "dm" : "portal";

      const docTypes = taskRelevantDocumentTypes(query.taskType);
      const factTypes = taskRelevantFactTypes(query.taskType);

      const [documents, facts] = await Promise.all([
        brainStore.listDocuments(worldSlug, {
          pageId: query.pageId,
          gameSessionId: query.sessionId,
          campaignId: query.campaignId,
          accessContext,
        }),
        brainStore.listFacts(worldSlug, {
          pageId: query.pageId,
          gameSessionId: query.sessionId,
          campaignId: query.campaignId,
          accessContext,
        }),
      ]);

      const filteredDocs = documents.filter(
        (doc) => !docTypes || docTypes.includes(doc.documentType),
      );
      const filteredFacts = facts.filter(
        (fact) => !factTypes || factTypes.includes(fact.factType),
      );

      const entries: BrainKnowledgeEntry[] = [
        ...filteredDocs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          visibility: doc.visibility,
          sourceType: `brain_document:${doc.documentType}`,
          objectRef: doc.pageId ? `page:${doc.pageId}` : null,
          trustLevel: doc.status,
        })),
        ...filteredFacts.map((fact) => ({
          id: fact.id,
          title: fact.title,
          content: fact.content,
          visibility: fact.visibility,
          sourceType: `brain_fact:${fact.factType}`,
          objectRef: fact.pageId ? `page:${fact.pageId}` : null,
          trustLevel: fact.status,
        })),
      ];

      return entries.slice(0, maxEntries);
    },
  };
}
