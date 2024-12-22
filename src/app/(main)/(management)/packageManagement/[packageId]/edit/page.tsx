// src/app/(main)/(management)/packageManagement/[id]/edit/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import PackageForm from "~/app/_components/form/package-form";
import { PackageFormData } from "~/lib/types";

const EditPackagePage: React.FC = () => {
  const router = useRouter();
  const { packageId } = useParams();

  // Pastikan packageId valid sebelum melakukan query
  const parsedPackageId = packageId ? Number(packageId) : undefined;

  const { data, isLoading, isError, error } = api.package.getPackage.useQuery(
    { id: parsedPackageId ?? 0 }, // Berikan default value 0 jika undefined
    {
      enabled: !!parsedPackageId, // Hanya jalankan query jika packageId ada
    },
  );

  const updatePackageMutation = api.package.updatePackage.useMutation({
    onSuccess: () => {
      toast.success("Package updated successfully!");
      router.push("/packageManagement");
    },
    onError: (error: any) => {
      console.error("Error:", error);
      toast.error("Failed to update package.");
    },
  });

  const handleSubmit = async (formData: PackageFormData) => {
    // Ubah tipe parameter
    if (!parsedPackageId) {
      toast.error("Invalid package ID.");
      return;
    }

    const updatedData: PackageFormData = {
      id: parsedPackageId, // Tambahkan id
      ...formData,
    };

    try {
      await updatePackageMutation.mutateAsync(updatedData);
    } catch (error) {
      console.error("Error updating package:", error);
    }
  };

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error: {error.message}</p>;
  if (!data) return <p>Package not found</p>;

  // Sanitasi data untuk menghapus field yang tidak diperlukan di frontend
  const sanitizedData: PackageFormData = {
    id: data.id,
    name: data.name,
    type: data.type,
    classId: data.classId,
    TOstart: data.TOstart,
    TOend: data.TOend,
    subtests: data.subtests.map((subtest) => ({
      id: subtest.id,
      type: subtest.type,
      duration: subtest.duration,
      questions: subtest.questions.map((question) => ({
        id: question.id,
        index: question.index,
        content: question.content,
        imageUrl: question.imageUrl || "",
        type: question.type,
        score: question.score,
        explanation: question.explanation || "",
        answers: question.answers.map((answer) => ({
          id: answer.id,
          index: answer.index,
          content: answer.content,
        })),
        correctAnswerChoice: question.correctAnswerChoice || undefined,
      })),
    })),
  };

  return (
    <div>
      <h1 className="flex justify-center text-2xl font-semibold">
        Edit Package
      </h1>
      <PackageForm initialData={sanitizedData} onSubmit={handleSubmit} />
    </div>
  );
};

export default EditPackagePage;