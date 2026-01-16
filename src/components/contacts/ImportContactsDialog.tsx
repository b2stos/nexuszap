import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, XCircle } from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedContacts: number;
  totalContacts: number;
  phase: "validating" | "importing";
}

const CONTACTS_PER_BATCH = 5000;
const VALIDATION_BATCH_SIZE = 100;

export function ImportContactsDialog({ open, onOpenChange }: ImportContactsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResults(null);
      setBatchProgress(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setBatchProgress(null);
    
    try {
      let jsonData: any[] = [];
      
      if (file.name.endsWith('.csv')) {
        // Use papaparse for CSV files
        jsonData = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => {
              const normalized = header.toLowerCase().trim();
              if (normalized.includes("nome") || normalized === "name") return "name";
              if (normalized.includes("telefone") || normalized === "phone" || normalized.includes("tel")) return "phone";
              return normalized;
            },
            complete: (results) => resolve(results.data),
            error: (error) => reject(error),
          });
        });
      } else {
        // Use exceljs for Excel files
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("Planilha vazia");
        
        // Get headers from first row
        const headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || "").toLowerCase().trim();
        });
        
        // Find column indexes
        const nameColIndex = headers.findIndex(h => h.includes("nome") || h === "name") + 1;
        const phoneColIndex = headers.findIndex(h => h.includes("telefone") || h === "phone" || h.includes("tel")) + 1;
        
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber] || `col${colNumber}`;
            rowData[header] = cell.value;
          });
          // Also map to standard names
          if (nameColIndex > 0) rowData.name = row.getCell(nameColIndex).value;
          if (phoneColIndex > 0) rowData.phone = row.getCell(phoneColIndex).value;
          jsonData.push(rowData);
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Extract and pre-filter contacts
      const rawContacts = jsonData
        .map((row: any) => ({
          name: String(row.nome || row.name || "").trim(),
          phone: String(row.telefone || row.phone || "").trim(),
        }))
        .filter(contact => {
          const phone = contact.phone;
          if (!phone) return false;
          if (phone.length < 8) return false;
          if (phone.length > 20) return false;
          if (!/\d/.test(phone)) return false;
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

        // Split into batches of 5000
        const totalBatches = Math.ceil(rawContacts.length / CONTACTS_PER_BATCH);
        let allValidResults: ValidationResult[] = [];
        let totalInserted = 0;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * CONTACTS_PER_BATCH;
          const batchEnd = Math.min(batchStart + CONTACTS_PER_BATCH, rawContacts.length);
          const batchContacts = rawContacts.slice(batchStart, batchEnd);

          // Update progress - validating phase
          setBatchProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedContacts: batchStart,
            totalContacts: rawContacts.length,
            phase: "validating",
          });

          // Validate in smaller batches
          const validationBatches: typeof batchContacts[] = [];
          for (let i = 0; i < batchContacts.length; i += VALIDATION_BATCH_SIZE) {
            validationBatches.push(batchContacts.slice(i, i + VALIDATION_BATCH_SIZE));
          }

          let batchResults: ValidationResult[] = [];

          for (let i = 0; i < validationBatches.length; i++) {
            const phoneNumbers = validationBatches[i].map(c => c.phone);
            
            const { data: validationData, error: validationError } = await supabase.functions.invoke(
              'validate-phone-numbers',
              { body: { phoneNumbers } }
            );

            if (validationError) {
              throw new Error(`Erro na validação: ${validationError.message}`);
            }
            
            if (!validationData || !validationData.results) {
              throw new Error('Resposta inválida da validação.');
            }
            
            batchResults = [...batchResults, ...(validationData.results as ValidationResult[])];

            // Update progress during validation
            setBatchProgress({
              currentBatch: batchIndex + 1,
              totalBatches,
              processedContacts: batchStart + (i + 1) * VALIDATION_BATCH_SIZE,
              totalContacts: rawContacts.length,
              phase: "validating",
            });
          }

          allValidResults = [...allValidResults, ...batchResults];

          // Filter valid contacts for this batch
          const validContacts = batchContacts
            .map((contact, index) => ({
              ...contact,
              validation: batchResults[index]
            }))
            .filter(c => c.validation?.isValid)
            .map(c => ({
              user_id: user.id,
              name: c.name,
              phone: c.validation.formatted,
              import_batch_id: crypto.randomUUID(),
            }));

          // Update progress - importing phase
          setBatchProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedContacts: batchStart,
            totalContacts: rawContacts.length,
            phase: "importing",
          });

          // Insert valid contacts
          if (validContacts.length > 0) {
            const INSERT_BATCH_SIZE = 500;
            for (let i = 0; i < validContacts.length; i += INSERT_BATCH_SIZE) {
              const insertBatch = validContacts.slice(i, i + INSERT_BATCH_SIZE);
              const { error } = await supabase
                .from("contacts")
                .upsert(insertBatch, { 
                  onConflict: 'user_id,phone',
                  ignoreDuplicates: false
                });

              if (error) throw error;
              totalInserted += insertBatch.length;
            }
          }

          // Notify batch completion
          if (totalBatches > 1) {
            toast({
              title: `Lote ${batchIndex + 1}/${totalBatches} concluído`,
              description: `${validContacts.length} contatos importados neste lote.`,
            });
          }
        }

        setValidationResults(allValidResults);

        const invalidCount = allValidResults.filter(r => !r.isValid).length;
        const validCount = allValidResults.filter(r => r.isValid).length;

        toast({
          title: "Importação concluída!",
          description: `${validCount} contatos importados! ${invalidCount > 0 ? `${invalidCount} números inválidos foram ignorados.` : ''}`,
        });

        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        
      setTimeout(() => {
        setFile(null);
        setValidationResults(null);
        setBatchProgress(null);
        onOpenChange?.(false);
      }, 3000);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      setBatchProgress(null);
    }
  };

  const validCount = validationResults?.filter(r => r.isValid).length || 0;
  const invalidCount = validationResults?.filter(r => !r.isValid).length || 0;
  const progressPercent = batchProgress 
    ? Math.round((batchProgress.processedContacts / batchProgress.totalContacts) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Contatos com Validação IA</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XLSX com as colunas "nome" e "telefone". 
            A IA irá validar e formatar os números automaticamente.
            <br />
            <span className="text-primary font-medium">
              Suporta arquivos grandes - processados automaticamente em lotes de 5.000.
            </span>
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
              Formatos aceitos: CSV, XLSX, XLS (sem limite de contatos)
            </p>
          </div>

          {/* Batch Progress */}
          {batchProgress && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {batchProgress.phase === "validating" ? "Validando..." : "Importando..."}
                </span>
                <span className="text-muted-foreground">
                  Lote {batchProgress.currentBatch} de {batchProgress.totalBatches}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{batchProgress.processedContacts.toLocaleString()} contatos processados</span>
                <span>{batchProgress.totalContacts.toLocaleString()} total</span>
              </div>
            </div>
          )}

          {validationResults && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{validCount.toLocaleString()} números válidos</span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{invalidCount.toLocaleString()} números inválidos (ignorados)</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validationResults && invalidCount > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              <p className="font-medium text-muted-foreground mb-2">Números inválidos (primeiros 100):</p>
              {validationResults
                .filter(r => !r.isValid)
                .slice(0, 100)
                .map((result, index) => (
                  <div key={index} className="text-red-500">
                    {result.original} - {result.reason || 'Formato inválido'}
                  </div>
                ))}
              {invalidCount > 100 && (
                <p className="text-muted-foreground mt-2">
                  ... e mais {invalidCount - 100} números inválidos
                </p>
              )}
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
                {batchProgress?.phase === "validating" ? "Validando..." : "Importando..."}
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
