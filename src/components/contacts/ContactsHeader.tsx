import { Button } from "@/components/ui/button";
import { Upload, UserPlus, Download } from "lucide-react";
import { useState } from "react";
import { ImportContactsWithPreview } from "./ImportContactsWithPreview";
import { AddMTContactDialog } from "./AddMTContactDialog";
import { downloadContactsCSVTemplate } from "@/utils/csvTemplateGenerator";
import { toast } from "@/hooks/use-toast";
import { useTenantRole } from "@/hooks/useTenantRole";

export function ContactsHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { tenantId } = useTenantRole();

  const handleDownloadTemplate = () => {
    downloadContactsCSVTemplate();
    toast({
      title: "Template baixado!",
      description: "Use este arquivo como exemplo para importar seus contatos",
    });
  };

  if (!tenantId) {
    return null;
  }

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
      <AddMTContactDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        tenantId={tenantId}
      />
      <ImportContactsWithPreview open={showImportDialog} onOpenChange={setShowImportDialog} />
    </>
  );
}
