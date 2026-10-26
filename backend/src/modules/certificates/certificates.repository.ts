import { randomBytes } from 'node:crypto';
import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { isTransactionConflict } from '../../utils/transactionConflict.js';
import type { Prisma } from '../../generated/prisma/client.js';

const include = {
  goal: true,
  user: true,
  certificate: true,
  phases: { include: { topics: { include: { submissions: true } } } },
};
type Roadmap = Prisma.RoadmapGetPayload<{ include: typeof include }>;
export function eligibility(roadmap: Roadmap) {
  const topics = roadmap.phases.flatMap((p) => p.topics);
  const remainingTopics = topics.filter((t) => t.status !== 'DONE').length;
  const missingProjects = topics.filter(
    (t) => t.isProject && !t.submissions.some((s) => s.userId === roadmap.userId),
  ).length;
  return {
    eligible: topics.length > 0 && remainingTopics === 0 && missingProjects === 0,
    remainingTopics,
    missingProjects,
  };
}
export function certificateView(roadmap: Roadmap, baseUrl: string) {
  const row = roadmap.certificate;
  if (!row) return null;
  return {
    id: row.id,
    recipientName: row.recipientName,
    roleTitle: row.roleTitle,
    completedHours: Number(row.completedHours),
    issuedAt: row.issuedAt.toISOString(),
    verificationCode: row.verificationCode,
    verificationUrl: new URL(`/verify/${row.verificationCode}`, baseUrl).href,
    status: eligibility(roadmap).eligible ? ('VALID' as const) : ('INACTIVE' as const),
  };
}
export type CertificateView = NonNullable<ReturnType<typeof certificateView>>;
export interface CertificateRepository {
  list(
    userId: string,
    baseUrl: string,
  ): Promise<{
    certificates: CertificateView[];
    roadmaps: {
      id: string;
      title: string;
      eligible: boolean;
      remainingTopics: number;
      missingProjects: number;
      certificateId: string | null;
    }[];
  }>;
  issue(userId: string, roadmapId: string, baseUrl: string): Promise<CertificateView>;
  find(key: string, baseUrl: string, userId?: string): Promise<CertificateView>;
}
function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
export class PrismaCertificateRepository implements CertificateRepository {
  async list(userId: string, baseUrl: string) {
    const rows = await database().roadmap.findMany({
      where: { userId },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return {
      certificates: rows.flatMap((row) => {
        const view = certificateView(row, baseUrl);
        return view ? [view] : [];
      }),
      roadmaps: rows.map((row) => ({
        id: row.id,
        title: row.title,
        ...eligibility(row),
        certificateId: row.certificate?.id ?? null,
      })),
    };
  }
  async issue(userId: string, roadmapId: string, baseUrl: string): Promise<CertificateView> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await database().$transaction(
          async (tx) => {
            const row = await tx.roadmap.findFirst({ where: { id: roadmapId, userId }, include });
            if (!row) throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
            if (!eligibility(row).eligible)
              throw new AppError(
                409,
                'CERTIFICATE_LOCKED',
                'Complete every topic and submit every required project first.',
              );
            if (!row.certificate)
              row.certificate = await tx.certificate.create({
                data: {
                  userId,
                  roadmapId,
                  verificationCode: randomBytes(32).toString('hex'),
                  recipientName: row.user.name,
                  roleTitle: row.goal.targetRole,
                  completedHours: row.phases
                    .flatMap((p) => p.topics)
                    .reduce((sum, t) => sum + Number(t.estimatedHours), 0),
                },
              });
            return certificateView(row, baseUrl)!;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (!isTransactionConflict(error)) throw error;
        if (attempt >= 3)
          throw new AppError(503, 'CERTIFICATE_BUSY', 'Please retry certificate issuance shortly.');
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
      }
    }
  }
  async find(key: string, baseUrl: string, userId?: string) {
    const row = await database().roadmap.findFirst({
      where: {
        ...(userId
          ? { userId, certificate: { id: key } }
          : { certificate: { verificationCode: key } }),
      },
      include,
    });
    if (!row) throw new AppError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate not found.');
    return certificateView(row, baseUrl)!;
  }
}
