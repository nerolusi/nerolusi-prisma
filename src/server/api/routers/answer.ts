import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const answerRouter = createTRPCRouter({
  getAnswer: protectedProcedure
    .input(
      z.object({
        questionId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const answers = await ctx.db.answer.findMany({
        where: { questionId: input.questionId },
        orderBy: { index: "asc" },
      });

      return answers ?? null;
    }),
});
