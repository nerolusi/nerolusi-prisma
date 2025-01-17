import { SubtestType } from "@prisma/client";
import { z } from "zod";
import {
  createTRPCRouter,
  teacherProcedure,
  userProcedure,
} from "~/server/api/trpc";

export const quizRouter = createTRPCRouter({
  getAnnouncement: userProcedure.query(async ({ ctx }) => {
    return await ctx.db.announcement.findFirst();
  }),

  upsertAnnouncement: teacherProcedure
    .input(
      z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.announcement.upsert({
        where: { id: 1 },
        update: { content: input.content, title: input.title, url: input.url },
        create: { content: input.content, title: input.title, url: input.url },
      });
    }),

  getPackageWithSubtest: userProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const packageData = await ctx.db.package.findUnique({
        where: {
          id: input.id,
        },
        omit: {
          id: true,
          classId: true,
        },
        include: {
          subtests: {
            include: {
              quizSession: {
                where: {
                  userId: ctx.session.user?.id,
                },
                select: {
                  endTime: true,
                  package: { select: { TOend: true } },
                  userAnswers: {
                    where: {
                      packageId: input.id,
                    },
                    select: {
                      question: {
                        select: {
                          correctAnswerChoice: true,
                          score: true,
                          answers: {
                            select: {
                              content: true,
                            },
                          },
                        },
                      },
                      answerChoice: true,
                      essayAnswer: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!packageData) {
        throw new Error("Package not found");
      }

      let totalScore = 0;

      const subtestsWithScores = packageData.subtests.map((subtest) => {
        const quizSession = subtest.quizSession[0];
        if (!quizSession) {
          return {
            ...subtest,
            quizSession: null,
            score: null,
          };
        }

        if (new Date(quizSession.package.TOend) > new Date()) {
          return {
            ...subtest,
            quizSession: quizSession.endTime,
            score: null,
          };
        }

        const score = quizSession.userAnswers.reduce((total, answer) => {
          if (answer.question.correctAnswerChoice !== null) {
            return (
              total +
              (answer.answerChoice === answer.question.correctAnswerChoice
                ? answer.question.score
                : 0)
            );
          } else if (answer.essayAnswer !== null) {
            const isEssayCorrect =
              answer.essayAnswer.trim().toLowerCase() ===
              answer.question.answers[0]?.content.trim().toLowerCase();
            return total + (isEssayCorrect ? answer.question.score : 0);
          }
          return total;
        }, 0);

        totalScore += score;

        return {
          ...subtest,
          quizSession: quizSession.endTime,
          score,
        };
      });

      return {
        ...packageData,
        totalScore,
        subtests: subtestsWithScores,
      };
    }),

  getSession: userProcedure
    .input(
      z.object({
        userId: z.string(),
        subtestId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.quizSession.findFirst({
        where: {
          userId: input.userId,
          subtestId: input.subtestId,
        },
      });
    }),

  createSession: userProcedure
    .input(
      z.object({
        userId: z.string(),
        packageId: z.number(),
        subtestId: z.number(),
        duration: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.quizSession.create({
        data: {
          userId: input.userId,
          packageId: input.packageId,
          subtestId: input.subtestId,
          duration: input.duration,
          endTime: new Date(new Date().getTime() + input.duration * 60 * 1000),
        },
      });
    }),

  getQuestionsBySubtest: userProcedure
    .input(z.object({ subtestId: z.number(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.quizSession.findFirst({
        where: {
          subtestId: input.subtestId,
          userId:
            ctx.session.user.role === "admin"
              ? (input.userId ?? ctx.session.user?.id)
              : ctx.session.user?.id,
        },
        select: { endTime: true, package: { select: { TOend: true } } },
      });

      if (!session) {
        return null;
      } else if (new Date(session.package.TOend) > new Date()) {
        return await ctx.db.question
          .findMany({
            where: { subtestId: input.subtestId },
            orderBy: { index: "asc" },
            include: {
              answers: true,
            },
          })
          .then((questions) =>
            questions.map((question) => ({
              ...question,
              correctAnswerChoice: null,
              explanation: null,
              score: null,
            })),
          );
      } else if (new Date(session.package.TOend) < new Date()) {
        return await ctx.db.question.findMany({
          where: { subtestId: input.subtestId },
          orderBy: { index: "asc" },
          include: {
            answers: true,
          },
        });
      }
    }),

  getSessionDetails: userProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.quizSession.findUnique({
        where: { id: input.sessionId },
        include: {
          subtest: true,
          package: { select: { TOend: true } },
          userAnswers: {
            where: { quizSessionId: input.sessionId },
          },
        },
      });

      if (
        !session ||
        (session.userId !== ctx.session.user?.id &&
          ctx.session.user?.role !== "admin")
      ) {
        return null;
      }

      return session;
    }),

  saveAnswer: userProcedure
    .input(
      z.object({
        answerChoice: z.number().nullable(),
        essayAnswer: z.string().nullable(),
        questionId: z.number(),
        userId: z.string(),
        packageId: z.number(),
        quizSessionId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        answerChoice,
        essayAnswer,
        questionId,
        userId,
        packageId,
        quizSessionId,
      } = input;

      if (answerChoice === null && essayAnswer === null) {
        throw new Error("Either answerChoice or essayAnswer must be provided.");
      }

      const userAnswer = await ctx.db.userAnswer.upsert({
        where: {
          userId_quizSessionId_questionId: {
            userId,
            quizSessionId,
            questionId,
          },
        },
        update: {
          answerChoice,
          essayAnswer,
        },
        create: {
          answerChoice,
          essayAnswer,
          questionId,
          userId,
          packageId,
          quizSessionId,
        },
      });

      return userAnswer;
    }),

  submitQuiz: userProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.quizSession.update({
        where: { id: input.sessionId },
        data: {
          endTime: new Date().toISOString(),
        },
      });
    }),

  getDrillSubtest: userProcedure
    .input(z.object({ subtest: z.nativeEnum(SubtestType) }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.subtest.findMany({
        where: {
          package: {
            type: "drill",
          },
          type: input.subtest,
        },
        select: {
          id: true,
          duration: true,
          package: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }),
});
