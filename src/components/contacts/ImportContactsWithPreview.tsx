import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, XCircle, FileText, AlertTriangle, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";

interface ImportContactsWithPreviewProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ParsedContact {
  name: string;
  phone: string;
  status: "pending" | "valid" | "invalid";
  error?: string;
  formatted?: string;
}

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedContacts: number;
  totalContacts: number;
  phase: "parsing" | "validating" | "importing";
}

const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Nome não pode ser vazio" })
    .max(100, { message: "Nome muito longo" }),
  phone: z.string()
    .trim()
    .min(10, { message: "Telefone muito curto" })
    .max(15, { message: "Telefone muito longo" })
    .regex(/^[0-9]+$/, { message: "Telefone deve conter apenas números" }),
});

const CONTACTS_PER_BATCH = 5000;

export function ImportContactsWithPreview({ open, onOpenChange }: ImportContactsWithPreviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [totalContactsInFile, setTotalContactsInFile] = useState(0);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [columnMapping, setColumnMapping] = useState<{ nameColumn: string; phoneColumn: string } | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [rawContactsData, setRawContactsData] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const validateContact = (contact: { name: string; phone: string }): { isValid: boolean; error?: string } => {
    try {
      contactSchema.parse(contact);
      return { isValid: true };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.errors?.[0]?.message || "Dados inválidos",
      };
    }
  };

  const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          const normalized = header.toLowerCase().trim();
          if (normalized.includes("nome") || normalized === "name") return "name";
          if (normalized.includes("telefone") || normalized === "phone" || normalized.includes("tel")) return "phone";
          return normalized;
        },
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const parseExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary", cellText: false, cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const processRawDataToContacts = (rawData: any[]): ParsedContact[] => {
    return rawData
      .map((row: any) => {
        const name = (row.nome || row.name || row.Nome || row.Name || "").trim();
        let phoneRaw = String(row.telefone || row.phone || row.Telefone || row.Phone || row.tel || "");
        
        if (phoneRaw.includes('E') || phoneRaw.includes('e')) {
          try {
            phoneRaw = Number(phoneRaw).toFixed(0);
          } catch {
            // Keep as is
          }
        }
        
        const phone = phoneRaw.replace(/\D/g, "");
        const validation = validateContact({ name, phone });

        return {
          name,
          phone,
          status: validation.isValid ? "pending" : "invalid",
          error: validation.error,
        } as ParsedContact;
      })
      .filter((contact) => contact.name || contact.phone);
  };

  const parseWithAI = async (rawData: any[], batchIndex: number, totalBatches: number): Promise<ParsedContact[]> => {
    setBatchProgress({
      currentBatch: batchIndex + 1,
      totalBatches,
      processedContacts: batchIndex * CONTACTS_PER_BATCH,
      totalContacts: totalBatches * CONTACTS_PER_BATCH,
      phase: "parsing",
    });

    const { data: aiResult, error: aiError } = await supabase.functions.invoke(
      "smart-contact-import",
      { body: { rawData } }
    );

    if (aiError) {
      throw new Error(aiError.message || "Erro ao processar com IA");
    }

    if (!aiResult?.processedContacts) {
      throw new Error("Resposta inválida da IA");
    }

    if (batchIndex === 0 && aiResult.columnMapping) {
      setColumnMapping(aiResult.columnMapping);
    }

    return aiResult.processedContacts.map((contact: any) => ({
      name: contact.name,
      phone: contact.phone,
      formatted: contact.phone,
      status: contact.isValid ? "valid" : "invalid",
      error: contact.error,
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setContacts([]);
    setColumnMapping(null);
    setBatchProgress(null);
    setParsing(true);

    try {
      let rawData: any[];

      // First, read the entire file
      if (selectedFile.name.endsWith(".csv")) {
        rawData = await parseCSV(selectedFile);
      } else if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
        rawData = await parseExcel(selectedFile);
      } else {
        throw new Error("Formato de arquivo não suportado");
      }

      if (rawData.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados",
          variant: "destructive",
        });
        setFile(null);
        return;
      }

      setTotalContactsInFile(rawData.length);
      setRawContactsData(rawData);

      // For preview, only show first 5000 (will process all in batches on import)
      const previewData = rawData.slice(0, CONTACTS_PER_BATCH);
      let parsedContacts: ParsedContact[];

      if (useAI) {
        parsedContacts = await parseWithAI(previewData, 0, Math.ceil(rawData.length / CONTACTS_PER_BATCH));
      } else {
        parsedContacts = processRawDataToContacts(previewData);
      }

      setContacts(parsedContacts);

      const totalBatches = Math.ceil(rawData.length / CONTACTS_PER_BATCH);
      const message = rawData.length > CONTACTS_PER_BATCH
        ? `${rawData.length.toLocaleString()} contatos detectados. Serão processados em ${totalBatches} lotes de ${CONTACTS_PER_BATCH.toLocaleString()}.`
        : `${parsedContacts.length} contatos encontrados.`;

      toast({
        title: useAI ? "IA processou o arquivo!" : "Arquivo processado!",
        description: message,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message,
        variant: "destructive",
      });
      setFile(null);
    } finally {
      setParsing(false);
      setBatchProgress(null);
    }
  };

  const handleImport = async () => {
    if (rawContactsData.length === 0) return;

    setLoading(true);
    setBatchProgress(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const totalBatches = Math.ceil(rawContactsData.length / CONTACTS_PER_BATCH);
      let totalInserted = 0;
      let totalInvalid = 0;
      let allProcessedContacts: ParsedContact[] = [];

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * CONTACTS_PER_BATCH;
        const batchEnd = Math.min(batchStart + CONTACTS_PER_BATCH, rawContactsData.length);
        const batchRawData = rawContactsData.slice(batchStart, batchEnd);

        // Skip first batch if we already have it processed (from preview)
        let batchContacts: ParsedContact[];
        
        if (batchIndex === 0 && contacts.length > 0) {
          batchContacts = contacts;
        } else if (useAI) {
          setBatchProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedContacts: batchStart,
            totalContacts: rawContactsData.length,
            phase: "parsing",
          });
          batchContacts = await parseWithAI(batchRawData, batchIndex, totalBatches);
        } else {
          batchContacts = processRawDataToContacts(batchRawData);
          
          // Validate with edge function
          setValidating(true);
          setBatchProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedContacts: batchStart,
            totalContacts: rawContactsData.length,
            phase: "validating",
          });

          const validContacts = batchContacts.filter(c => c.status === "pending");
          const VALIDATION_BATCH_SIZE = 100;
          
          for (let i = 0; i < validContacts.length; i += VALIDATION_BATCH_SIZE) {
            const validationBatch = validContacts.slice(i, i + VALIDATION_BATCH_SIZE);
            const phoneNumbers = validationBatch.map(c => c.phone);

            const { data: validationData, error: validationError } = await supabase.functions.invoke(
              "validate-phone-numbers",
              { body: { phoneNumbers } }
            );

            if (validationError || !validationData?.results) {
              throw new Error("Erro na validação de telefones");
            }

            validationBatch.forEach((contact, index) => {
              const result = validationData.results[index];
              const contactIndex = batchContacts.findIndex(
                c => c.phone === contact.phone && c.name === contact.name
              );

              if (contactIndex !== -1) {
                batchContacts[contactIndex] = {
                  ...batchContacts[contactIndex],
                  status: result.isValid ? "valid" : "invalid",
                  error: result.isValid ? undefined : result.reason,
                  formatted: result.isValid ? result.formatted : undefined,
                };
              }
            });
          }
          setValidating(false);
        }

        allProcessedContacts = [...allProcessedContacts, ...batchContacts];

        // Prepare contacts for insertion
        const validContactsForInsert = batchContacts
          .filter(c => c.status === "valid" || (c.status === "pending" && useAI))
          .filter(c => (c.formatted || c.phone))
          .map(c => ({
            user_id: user.id,
            name: c.name,
            phone: c.formatted || c.phone,
            import_batch_id: crypto.randomUUID(),
          }));

        totalInvalid += batchContacts.filter(c => c.status === "invalid").length;

        // Insert in sub-batches
        setBatchProgress({
          currentBatch: batchIndex + 1,
          totalBatches,
          processedContacts: batchStart,
          totalContacts: rawContactsData.length,
          phase: "importing",
        });

        const INSERT_BATCH_SIZE = 500;
        for (let i = 0; i < validContactsForInsert.length; i += INSERT_BATCH_SIZE) {
          const insertBatch = validContactsForInsert.slice(i, i + INSERT_BATCH_SIZE);
          
          const { error } = await supabase
            .from("contacts")
            .upsert(insertBatch, { 
              onConflict: 'user_id,phone',
              ignoreDuplicates: false
            });
            
          if (error) throw error;
          totalInserted += insertBatch.length;
        }

        // Update UI with progress for this batch
        if (totalBatches > 1) {
          toast({
            title: `Lote ${batchIndex + 1}/${totalBatches} concluído`,
            description: `${validContactsForInsert.length.toLocaleString()} contatos processados.`,
          });
        }
      }

      // Update contacts state with all processed
      setContacts(allProcessedContacts);

      toast({
        title: "Importação concluída com sucesso!",
        description: `${totalInserted.toLocaleString()} contatos importados! ${
          totalInvalid > 0 ? `${totalInvalid.toLocaleString()} inválidos ignorados.` : ""
        }`,
      });

      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      setTimeout(() => {
        setFile(null);
        setContacts([]);
        setColumnMapping(null);
        setRawContactsData([]);
        setTotalContactsInFile(0);
        setBatchProgress(null);
        onOpenChange?.(false);
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erro ao importar contatos",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setValidating(false);
      setBatchProgress(null);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setContacts([]);
    setColumnMapping(null);
    setRawContactsData([]);
    setTotalContactsInFile(0);
    setBatchProgress(null);
    onOpenChange?.(false);
  };

  const validCount = contacts.filter((c) => c.status === "valid").length;
  const pendingCount = contacts.filter((c) => c.status === "pending").length;
  const invalidCount = contacts.filter((c) => c.status === "invalid").length;
  const totalBatches = Math.ceil(totalContactsInFile / CONTACTS_PER_BATCH);
  const progressPercent = batchProgress 
    ? Math.round((batchProgress.processedContacts / batchProgress.totalContacts) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Contatos com Preview
          </DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XLSX em qualquer formato. {useAI ? "A IA detectará automaticamente as colunas." : "Use o formato padrão com colunas 'nome' e 'telefone'."}
            <br />
            <span className="text-primary font-medium">
              Sem limite de contatos - processamento automático em lotes de 5.000.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* AI Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="ai-mode" className="text-sm font-medium cursor-pointer">
                  Importação Inteligente com IA
                </Label>
                <p className="text-xs text-muted-foreground">
                  {useAI 
                    ? "Detecta colunas automaticamente e normaliza telefones em qualquer formato" 
                    : "Modo tradicional: requer colunas 'nome' e 'telefone'"}
                </p>
              </div>
            </div>
            <Switch
              id="ai-mode"
              checked={useAI}
              onCheckedChange={setUseAI}
              disabled={loading || parsing || contacts.length > 0}
            />
          </div>

          {/* Column Mapping Info */}
          {columnMapping && (
            <Alert className="bg-primary/10 border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>IA detectou:</strong> Nome = "{columnMapping.nameColumn}", Telefone = "{columnMapping.phoneColumn}"
              </AlertDescription>
            </Alert>
          )}

          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={loading || parsing}
            />
            <p className="text-xs text-muted-foreground">
              {useAI 
                ? "Aceita qualquer formato de planilha. A IA identificará as colunas automaticamente." 
                : "Formato: CSV ou XLSX com colunas 'nome' e 'telefone'"}
            </p>
          </div>

          {/* Batch Info for large files */}
          {totalContactsInFile > CONTACTS_PER_BATCH && (
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              <AlertDescription>
                <strong>Arquivo grande detectado:</strong> {totalContactsInFile.toLocaleString()} contatos serão processados em {totalBatches} lotes automáticos.
                <br />
                <span className="text-xs text-muted-foreground">
                  Preview mostrando primeiros {Math.min(contacts.length, CONTACTS_PER_BATCH).toLocaleString()} contatos.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Parsing/Batch Progress */}
          {(parsing || batchProgress) && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {parsing ? "Analisando arquivo..." : 
                   batchProgress?.phase === "parsing" ? "Processando com IA..." :
                   batchProgress?.phase === "validating" ? "Validando telefones..." : 
                   "Importando contatos..."}
                </span>
                {batchProgress && (
                  <span className="text-muted-foreground">
                    Lote {batchProgress.currentBatch} de {batchProgress.totalBatches}
                  </span>
                )}
              </div>
              {batchProgress && (
                <>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{batchProgress.processedContacts.toLocaleString()} processados</span>
                    <span>{batchProgress.totalContacts.toLocaleString()} total</span>
                  </div>
                </>
              )}
              {parsing && !batchProgress && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Lendo arquivo...</span>
                </div>
              )}
            </div>
          )}

          {/* Statistics */}
          {contacts.length > 0 && !parsing && (
            <div className="grid grid-cols-3 gap-4">
              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">{totalContactsInFile > CONTACTS_PER_BATCH ? totalContactsInFile.toLocaleString() : contacts.length}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  {validCount > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  <div>
                    <div className="font-semibold">{validCount + pendingCount}</div>
                    <div className="text-xs text-muted-foreground">Válidos (preview)</div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="font-semibold">{invalidCount}</div>
                    <div className="text-xs text-muted-foreground">Inválidos (preview)</div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Validating Status */}
          {validating && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Validando números de telefone com IA...</AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {contacts.length > 0 && !parsing && (
            <div className="flex-1 overflow-hidden border rounded-lg">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.slice(0, 100).map((contact, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell className="font-mono">
                          {contact.formatted || contact.phone}
                        </TableCell>
                        <TableCell>
                          {contact.status === "valid" && (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          )}
                          {contact.status === "pending" && (
                            <Badge variant="secondary">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                          {contact.status === "invalid" && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              {contact.error || "Inválido"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {contacts.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                          ... e mais {(contacts.length - 100).toLocaleString()} contatos no preview
                          {totalContactsInFile > CONTACTS_PER_BATCH && (
                            <span className="block text-xs">
                              ({(totalContactsInFile - CONTACTS_PER_BATCH).toLocaleString()} adicionais serão processados durante a importação)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={loading} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || contacts.length === 0 || loading || (validCount + pendingCount) === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {batchProgress?.phase === "importing" ? "Importando..." : "Processando..."}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar {totalContactsInFile > 0 && `(${totalContactsInFile.toLocaleString()})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
