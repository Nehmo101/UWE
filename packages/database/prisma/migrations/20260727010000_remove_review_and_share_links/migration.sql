-- Review process and anonymous share links removed.
--
-- Review: content proposals were approved before they became visible. With page
-- visibility gone (a world member sees everything in their world), the approval
-- step has nothing left to gate.
--
-- Share links: anonymous, link-only access was the single exception to the rule
-- that only allow-listed accounts reach UWE. It falls with that rule restated.
DROP TABLE IF EXISTS "review_comments";
DROP TABLE IF EXISTS "content_reviews";
DROP TABLE IF EXISTS "share_access_logs";
DROP TABLE IF EXISTS "share_links";
