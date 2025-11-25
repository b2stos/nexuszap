import { Button } from "@/components/ui/button";
import { Upload, UserPlus, Download } from "lucide-react";
import { useState } from "react";
import { ImportContactsWithPreview } from "./ImportContactsWithPreview";
import { AddContactDialog } from "./AddContactDialog";
import { downloadContactsCSVTemplate } from "@/utils/csvTemplateGenerator";
import { toast } from "@/hooks/use-toast";

export function ContactsHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleDownloadTemplate = () => {
    downloadContactsCSVTemplate();
    toast({
      title: "Template baixado!",
      description: "Use este arquivo como exemplo para importar seus contatos",
    });
  };

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
          <Button onClick={handleDownloadTemplate} variant="ghost" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Template CSV
          </Button>
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
      <ImportContactsWithPreview open={showImportDialog} onOpenChange={setShowImportDialog} />
    </>
  );
}
