import { Button } from "@/components/ui/button";
import { Upload, UserPlus } from "lucide-react";
import { useState } from "react";
import { ImportContactsDialog } from "./ImportContactsDialog";
import { AddContactDialog } from "./AddContactDialog";

export function ContactsHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Contatos</h2>
          <p className="text-muted-foreground mt-2">
            Gerencie seus contatos, adicione ou importe via arquivo
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar Contato
          </Button>
          <Button onClick={() => setShowImportDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Contatos
          </Button>
        </div>
      </div>
      <AddContactDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <ImportContactsDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </>
  );
}
