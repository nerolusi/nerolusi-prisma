"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "~/app/_components/ui/button";
import { api } from "~/trpc/react";

export default function QuizPage() {
  const { paket } = useParams();
  const startSessionMutation = api.quiz.createSession.useMutation();
  const router = useRouter();
  const session = useSession();

  const {
    data: subtests,
    isLoading,
    isError,
  } = api.subtest.getByPackage.useQuery({ id: Number(paket) });

  if (isLoading) return <div>Loading subtests...</div>;
  if (isError) return <div>Failed to load subtests</div>;

  return (
    <div className="p-4">
      {/* Display the package name */}
      <h1 className="mb-4 text-xl font-bold">Package: {paket}</h1>
      {/* Render buttons for each subtest */}
      <div className="flex flex-wrap gap-4">
        {subtests?.map((subtest) => (
          <Button
            key={subtest.id}
            onClick={() => handleSubtestClick(subtest.id, subtest.duration)}
            className="w-full sm:w-auto"
          >
            {subtest.type}
          </Button>
        ))}
      </div>
    </div>
  );

  async function handleSubtestClick(subtestId: number, duration: number) {
    try {
      // Start the session by calling the mutation
      const quizSession = await startSessionMutation.mutateAsync({
        userId: session.data.user.id,
        packageId: Number(paket),
        subtestId,
        duration: duration ?? 10000,
      });

      // After session is successfully created, navigate to the tryout page
      if (quizSession) {
        router.push(`/tryout/${paket}/${quizSession.id}`);
      }
    } catch (error) {
      toast.error("Error creating sesion");
    }
  }
}
