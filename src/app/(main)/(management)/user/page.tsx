import { api } from "~/trpc/server";
import CreateClassDialog from "./CreateClassDialog";
import UserTable from "./UserTable";

export default async function Page() {
  const users = await api.user.getAllUsers();

  return (
    <div>
      <CreateClassDialog />
      <UserTable userData={users} />
    </div>
  );
}
