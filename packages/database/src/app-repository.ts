import { prisma } from "./client";
import { UweRepository } from "./repository";

const globalForRepo = globalThis as unknown as {
  uweRepository?: UweRepository;
};

export function getAppRepository(): UweRepository {
  if (!globalForRepo.uweRepository) {
    globalForRepo.uweRepository = new UweRepository(prisma);
  }

  return globalForRepo.uweRepository;
}
