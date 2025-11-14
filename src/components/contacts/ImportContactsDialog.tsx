import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";

interface ImportContactsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImportContactsDialog({ open, onOpenChange }: ImportContactsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `+55${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+55${cleaned}`;
    }
    return cleaned;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const contacts = jsonData.map((row: any) => ({
          user_id: user.id,
          name: row.nome || row.name || "",
          phone: normalizePhone(row.telefone || row.phone || ""),
          import_batch_id: crypto.randomUUID(),
        }));

        const { error } = await supabase
          .from("contacts")
          .insert(contacts);

        if (error) throw error;

        toast({
          title: "Importação concluída",
          description: `${contacts.length} contatos importados com sucesso!`,
        });

        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        setFile(null);
        onOpenChange?.(false);
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Contatos</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XLSX com as colunas "nome" e "telefone"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: CSV, XLSX, XLS
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
