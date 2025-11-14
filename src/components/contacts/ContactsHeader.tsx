import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useState } from "react";
import { ImportContactsDialog } from "./ImportContactsDialog";

export function ContactsHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Contatos</h2>
          <p className="text-muted-foreground mt-2">
            Gerencie seus contatos e importe novos via arquivo
          </p>
        </div>
        <Button onClick={() => setShowImportDialog(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Contatos
        </Button>
      </div>
      <ImportContactsDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </>
  );
}
