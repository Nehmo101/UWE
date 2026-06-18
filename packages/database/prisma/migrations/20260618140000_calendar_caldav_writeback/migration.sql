ALTER TABLE "calendar_feeds" ADD COLUMN "credentials_enc" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "remote_href" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "remote_etag" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "caldav_pending" BOOLEAN NOT NULL DEFAULT false;
