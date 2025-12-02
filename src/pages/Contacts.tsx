import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ContactsHeader } from "@/components/contacts/ContactsHeader";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";

export default function Contacts() {
  const user = useProtectedUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <ContactsHeader />
        <ContactsTable />
        <ImportContactsDialog />
      </div>
    </DashboardLayout>
  );
}
