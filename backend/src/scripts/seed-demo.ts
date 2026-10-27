import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import { registerSchema } from '../modules/auth/auth.schemas.js';
import { getDatabase, disconnectDatabase } from '../config/database.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { isTransactionConflict } from '../utils/transactionConflict.js';
import { utcWeek } from '../modules/notifications/notifications.logic.js';
export const DEMO_USER_ID = '90000000-0000-4000-8000-000000000001';
const name = 'linkup Demo Learner';
export function demoOptions(input: NodeJS.ProcessEnv) {
  if (input.NODE_ENV === 'production')
    throw new Error(
      'Demo seeding is local/test only. Production visitors should create their own accounts.',
    );
  const parsed = registerSchema.safeParse({
    name,
    email: input.DEMO_SEED_EMAIL || 'demo@linkup.example.invalid',
    password: input.DEMO_SEED_PASSWORD,
  });
  if (!parsed.success || parsed.data.password.length < 12)
    throw new Error(
      'Set a valid DEMO_SEED_EMAIL and a DEMO_SEED_PASSWORD of at least 12 characters in your private environment.',
    );
  return parsed.data;
}
export async function seedDemo(
  db: PrismaClient,
  options: ReturnType<typeof demoOptions>,
  now = new Date(),
) {
  const passwordHash = await bcrypt.hash(options.password, 12);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const shift = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
  const currentWeek = new Date(utcWeek(today));
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.user.findFirst({
            where: { OR: [{ id: DEMO_USER_ID }, { email: options.email }] },
          });
          if (existing) {
            if (
              existing.id !== DEMO_USER_ID ||
              existing.email !== options.email ||
              existing.name !== name
            )
              throw new Error('Demo seed conflicts with an existing account. No data was changed.');
            return { created: false, userId: existing.id };
          }
          const python = await tx.skill.findUnique({ where: { name: 'Python' } });
          if (!python) throw new Error('Apply catalogue migrations before seeding demo data.');
          await tx.user.create({
            data: {
              id: DEMO_USER_ID,
              name,
              email: options.email,
              passwordHash,
              skills: { create: { skillId: python.id, level: 'BEGINNER' } },
            },
          });
          const goal = await tx.goal.create({
            data: { userId: DEMO_USER_ID, targetRole: 'Learn Python' },
          });
          const roadmap = await tx.roadmap.create({
            data: {
              userId: DEMO_USER_ID,
              goalId: goal.id,
              title: 'Python: demo learning roadmap',
              status: 'ACTIVE',
              totalEstimatedHours: 14,
              generationSource: 'demo',
              phases: {
                create: [
                  {
                    order: 0,
                    title: 'Foundations',
                    description: 'Illustrative Python learning work.',
                    topics: {
                      create: [
                        {
                          order: 0,
                          title: 'Python basics',
                          skillId: python.id,
                          estimatedHours: 4,
                          difficulty: 'BEGINNER',
                          status: 'DONE',
                          completedAt: shift(today, -2),
                          subtopics: ['Variables and collections', 'Functions and conditions'],
                        },
                        {
                          order: 1,
                          title: 'Practice and testing',
                          skillId: python.id,
                          estimatedHours: 6,
                          difficulty: 'INTERMEDIATE',
                          subtopics: ['Write small functions', 'Test edge cases'],
                        },
                      ],
                    },
                  },
                  {
                    order: 1,
                    title: 'Apply what you learned',
                    description:
                      'Demo project evidence is illustrative, not independently assessed.',
                    topics: {
                      create: {
                        order: 0,
                        title: 'Build a command-line inventory tool',
                        estimatedHours: 4,
                        difficulty: 'INTERMEDIATE',
                        isProject: true,
                        subtopics: ['Create commands', 'Test and document the program'],
                      },
                    },
                  },
                ],
              },
            },
            include: {
              phases: {
                orderBy: { order: 'asc' },
                include: { topics: { orderBy: { order: 'asc' } } },
              },
            },
          });
          const basics = roadmap.phases[0]!.topics[0]!,
            practice = roadmap.phases[0]!.topics[1]!,
            project = roadmap.phases[1]!.topics[0]!;
          await tx.plan.create({
            data: {
              roadmapId: roadmap.id,
              hoursPerWeek: 8,
              startDate: shift(currentWeek, -7),
              projectedEndDate: shift(currentWeek, 6),
              flexibilityMode: 'STANDARD',
              weeks: {
                create: [
                  {
                    weekNumber: 1,
                    startDate: shift(currentWeek, -7),
                    plannedHours: 8,
                    focusSummary: 'Learn Python foundations',
                    items: {
                      create: [
                        {
                          topicId: basics.id,
                          allocatedHours: 4,
                          status: 'DONE',
                          completedAt: shift(today, -2),
                        },
                        { topicId: practice.id, allocatedHours: 4 },
                      ],
                    },
                  },
                  {
                    weekNumber: 2,
                    startDate: currentWeek,
                    plannedHours: 6,
                    focusSummary: 'Practice and build a project',
                    items: {
                      create: [
                        { topicId: practice.id, allocatedHours: 2 },
                        { topicId: project.id, allocatedHours: 4 },
                      ],
                    },
                  },
                ],
              },
            },
          });
          await tx.learningLog.createMany({
            data: [0, 1, 2].map((day) => ({
              userId: DEMO_USER_ID,
              requestId: randomUUID(),
              topicId: basics.id,
              minutes: day === 0 ? 60 : 30,
              note: 'Illustrative demo learning session: practiced Python functions and reviewed mistakes.',
              loggedAt: shift(today, -day),
            })),
          });
          await tx.projectSubmission.create({
            data: {
              userId: DEMO_USER_ID,
              topicId: project.id,
              title: 'Demo inventory project evidence',
              notes:
                'Illustrative demo evidence: built commands, added tests and documented setup. Replace this with your own work.',
            },
          });
          const requestId = randomUUID();
          await tx.chatSession.create({
            data: {
              userId: DEMO_USER_ID,
              roadmapId: roadmap.id,
              version: 1,
              messages: {
                create: [
                  {
                    role: 'USER',
                    content: 'What should I focus on next?',
                    requestId,
                    position: 0,
                    mode: 'offline',
                  },
                  {
                    role: 'ASSISTANT',
                    content:
                      'Offline demo guidance: finish Python practice, then build and review your inventory project. Use the weekly plan to track your work.',
                    requestId,
                    position: 1,
                    mode: 'offline',
                  },
                ],
              },
            },
          });
          await tx.notification.create({
            data: {
              userId: DEMO_USER_ID,
              type: 'WEEKLY_REMINDER',
              title: 'Your demo learning check-in',
              message:
                'Review your remaining practice and project tasks. This is an illustrative demo reminder.',
              deduplicationKey: `${DEMO_USER_ID}:${utcWeek(today)}:WEEKLY_REMINDER`,
              createdAt: now,
            },
          });
          return { created: true, userId: DEMO_USER_ID };
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      );
    } catch (error) {
      if (!isTransactionConflict(error) || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = demoOptions(process.env);
    const db = getDatabase();
    if (!db) throw new Error('Configure a local/test DATABASE_URL first.');
    const result = await seedDemo(db, options);
    console.log(
      result.created
        ? 'Demo data created. Sign in with your configured demo email/password.'
        : 'Demo data already exists. No records or passwords were changed.',
    );
  } catch {
    console.error(
      'Demo seed failed. Use a migrated local/test database, valid private demo credentials and an unused demo email. Production seeding is disabled.',
    );
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
