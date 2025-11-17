import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportContactsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ValidationResult {
  original: string;
  formatted: string;
  isValid: boolean;
  reason?: string;
}

export function ImportContactsDialog({ open, onOpenChange }: ImportContactsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResults(null);
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

        // Extract and pre-filter contacts
        const rawContacts = jsonData
          .map((row: any) => ({
            name: row.nome || row.name || "",
            phone: String(row.telefone || row.phone || "").trim(),
          }))
          .filter(contact => {
            // Pre-validate: remove empty and obviously invalid
            const phone = contact.phone;
            if (!phone) return false;
            if (phone.length < 8) return false; // Too short
            if (phone.length > 20) return false; // Too long
            if (!/\d/.test(phone)) return false; // Must contain digits
            return true;
          });

        if (rawContacts.length === 0) {
          toast({
            title: "Nenhum telefone válido encontrado",
            description: "O arquivo não contém números de telefone válidos.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Limit to 1000 contacts per import
        const MAX_CONTACTS = 1000;
        if (rawContacts.length > MAX_CONTACTS) {
          toast({
            title: "Muitos contatos",
            description: `Limite de ${MAX_CONTACTS} contatos por importação. Encontrados: ${rawContacts.length}. Divida em arquivos menores.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Process in batches of 100
        const BATCH_SIZE = 100;
        const batches: typeof rawContacts[] = [];
        for (let i = 0; i < rawContacts.length; i += BATCH_SIZE) {
          batches.push(rawContacts.slice(i, i + BATCH_SIZE));
        }

        let allResults: ValidationResult[] = [];
        
        // Process each batch
        for (let i = 0; i < batches.length; i++) {
          toast({
            title: "Validando...",
            description: `Processando lote ${i + 1} de ${batches.length} (${batches[i].length} números)`,
          });

          const phoneNumbers = batches[i].map(c => c.phone);
          const { data: validationData, error: validationError } = await supabase.functions.invoke(
            'validate-phone-numbers',
            {
              body: { phoneNumbers }
            }
          );

          if (validationError) throw validationError;
          
          allResults = [...allResults, ...(validationData.results as ValidationResult[])];
        }

        setValidationResults(allResults);

        // Filter valid contacts
        const validContacts = rawContacts
          .map((contact, index) => ({
            ...contact,
            validation: allResults[index]
          }))
          .filter(c => c.validation?.isValid)
          .map(c => ({
            user_id: user.id,
            name: c.name,
            phone: c.validation.formatted,
            import_batch_id: crypto.randomUUID(),
          }));

        if (validContacts.length === 0) {
          toast({
            title: "Nenhum número válido",
            description: "Nenhum número de telefone válido foi encontrado após validação.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase
          .from("contacts")
          .insert(validContacts);

        if (error) throw error;

        const invalidCount = allResults.filter(r => !r.isValid).length;
        const validCount = allResults.filter(r => r.isValid).length;

        toast({
          title: "Importação concluída",
          description: `${validCount} contatos válidos importados! ${invalidCount > 0 ? `${invalidCount} números inválidos foram ignorados.` : ''}`,
        });

        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        
        // Reset after a delay so user can see results
        setTimeout(() => {
          setFile(null);
          setValidationResults(null);
          onOpenChange?.(false);
        }, 3000);
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const validCount = validationResults?.filter(r => r.isValid).length || 0;
  const invalidCount = validationResults?.filter(r => !r.isValid).length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Contatos com Validação IA</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XLSX com as colunas "nome" e "telefone". 
            A IA irá validar e formatar os números automaticamente.
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
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: CSV, XLSX, XLS
            </p>
          </div>

          {validationResults && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{validCount} números válidos</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{invalidCount} números inválidos (serão ignorados)</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults && invalidCount > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              <p className="font-medium text-muted-foreground mb-2">Números inválidos:</p>
              {validationResults
                .filter(r => !r.isValid)
                .map((result, index) => (
                  <div key={index} className="text-red-500">
                    {result.original} - {result.reason || 'Formato inválido'}
                  </div>
                ))}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando e importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar com Validação IA
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
