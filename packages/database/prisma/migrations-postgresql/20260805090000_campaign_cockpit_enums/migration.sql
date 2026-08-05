-- Kampagnen-Cockpit: zwei Enum-Erweiterungen (PostgreSQL).
--
-- `PageType.story_arc`               — Story-Bogen/Kapitel einer Kampagne.
-- `WorldEventEntityRole.trigger`     — diese Seite hat das Ereignis ausgelöst.
-- `WorldEventEntityRole.consequence` — das Ereignis zieht diese Seite nach sich.
--
-- `ADD VALUE IF NOT EXISTS` hängt die Labels an den bestehenden Typ an;
-- Bestandszeilen bleiben unberührt.

-- AlterEnum
ALTER TYPE "PageType" ADD VALUE IF NOT EXISTS 'story_arc';

-- AlterEnum
ALTER TYPE "WorldEventEntityRole" ADD VALUE IF NOT EXISTS 'trigger';

-- AlterEnum
ALTER TYPE "WorldEventEntityRole" ADD VALUE IF NOT EXISTS 'consequence';
