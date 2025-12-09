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

export function ImportContactsWithPreview({ open, onOpenChange }: ImportContactsWithPreviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [columnMapping, setColumnMapping] = useState<{ nameColumn: string; phoneColumn: string } | null>(null);
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

  const parseCSV = (file: File): Promise<ParsedContact[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Normalize headers
          const normalized = header.toLowerCase().trim();
          if (normalized.includes("nome") || normalized === "name") return "name";
          if (normalized.includes("telefone") || normalized === "phone" || normalized.includes("tel")) return "phone";
          return normalized;
        },
        complete: (results) => {
          const parsedContacts: ParsedContact[] = results.data
            .map((row: any) => {
              const name = (row.name || row.nome || "").trim();
              const phone = String(row.phone || row.telefone || row.tel || "").replace(/\D/g, "");

              const validation = validateContact({ name, phone });

              return {
                name,
                phone,
                status: validation.isValid ? "pending" : "invalid",
                error: validation.error,
              } as ParsedContact;
            })
            .filter((contact) => contact.name || contact.phone); // Remove completely empty rows

          resolve(parsedContacts);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const parseExcel = async (file: File): Promise<ParsedContact[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary", cellText: false, cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert with raw values to handle scientific notation
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

          const parsedContacts: ParsedContact[] = jsonData
            .map((row: any) => {
              const name = (row.nome || row.name || row.Nome || row.Name || "").trim();
              
              // Handle scientific notation and various formats
              let phoneRaw = String(row.telefone || row.phone || row.Telefone || row.Phone || row.tel || "");
              
              // Convert scientific notation (e.g., 5.51199E+10) to full number
              if (phoneRaw.includes('E') || phoneRaw.includes('e')) {
                try {
                  phoneRaw = Number(phoneRaw).toFixed(0);
                } catch {
                  // Keep as is if conversion fails
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

          resolve(parsedContacts);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const parseWithAI = async (file: File): Promise<ParsedContact[]> => {
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          let rawData: any[];

          if (file.name.endsWith(".csv")) {
            // Parse CSV to raw data
            const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
            rawData = result.data;
          } else {
            // Parse Excel to raw data
            const workbook = XLSX.read(data, { type: "binary", cellText: false, cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
          }

          if (rawData.length === 0) {
            reject(new Error("Arquivo vazio"));
            return;
          }

          // Call AI edge function
          const { data: aiResult, error: aiError } = await supabase.functions.invoke(
            "smart-contact-import",
            { body: { rawData } }
          );

          if (aiError) {
            console.error("AI parsing error:", aiError);
            reject(new Error(aiError.message || "Erro ao processar com IA"));
            return;
          }

          if (!aiResult?.processedContacts) {
            reject(new Error("Resposta inválida da IA"));
            return;
          }

          // Set column mapping for display
          if (aiResult.columnMapping) {
            setColumnMapping(aiResult.columnMapping);
          }

          // Convert AI results to ParsedContact format
          const parsedContacts: ParsedContact[] = aiResult.processedContacts.map((contact: any) => ({
            name: contact.name,
            phone: contact.phone,
            formatted: contact.phone,
            status: contact.isValid ? "valid" : "invalid",
            error: contact.error,
          }));

          resolve(parsedContacts);
        } catch (error: any) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      
      if (file.name.endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setContacts([]);
    setColumnMapping(null);
    setParsing(true);

    try {
      let parsedContacts: ParsedContact[];

      if (useAI) {
        // Use AI-powered parsing
        parsedContacts = await parseWithAI(selectedFile);
      } else {
        // Use traditional parsing
        if (selectedFile.name.endsWith(".csv")) {
          parsedContacts = await parseCSV(selectedFile);
        } else if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
          parsedContacts = await parseExcel(selectedFile);
        } else {
          throw new Error("Formato de arquivo não suportado");
        }
      }

      if (parsedContacts.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém contatos válidos",
          variant: "destructive",
        });
        setFile(null);
        return;
      }

      if (parsedContacts.length > 5000) {
        toast({
          title: "Muitos contatos",
          description: `Limite de 5000 contatos por importação. Encontrados: ${parsedContacts.length}. Usando os primeiros 5000.`,
          variant: "destructive",
        });
        parsedContacts = parsedContacts.slice(0, 5000);
      }

      setContacts(parsedContacts);

      toast({
        title: useAI ? "IA processou o arquivo!" : "Arquivo processado!",
        description: `${parsedContacts.length} contatos encontrados. ${useAI ? "Telefones já normalizados pela IA." : "Revise antes de importar."}`,
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
    }
  };

  const handleImport = async () => {
    if (contacts.length === 0) return;

    const validContacts = contacts.filter((c) => c.status === "pending" || c.status === "valid");

    if (validContacts.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Não há contatos válidos para importar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let contactsToInsert;

      if (useAI) {
        // AI already validated, use directly
        contactsToInsert = validContacts.map((c) => ({
          user_id: user.id,
          name: c.name,
          phone: c.formatted || c.phone,
          import_batch_id: crypto.randomUUID(),
        }));
      } else {
        // Traditional validation
        setValidating(true);
        
        const BATCH_SIZE = 100;
        const batches: ParsedContact[][] = [];
        for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
          batches.push(validContacts.slice(i, i + BATCH_SIZE));
        }

        let updatedContacts = [...contacts];

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const phoneNumbers = batch.map((c) => c.phone);

          const { data: validationData, error: validationError } = await supabase.functions.invoke(
            "validate-phone-numbers",
            { body: { phoneNumbers } }
          );

          if (validationError || !validationData?.results) {
            throw new Error("Erro na validação de telefones");
          }

          batch.forEach((contact, index) => {
            const result = validationData.results[index];
            const contactIndex = updatedContacts.findIndex(
              (c) => c.phone === contact.phone && c.name === contact.name
            );

            if (contactIndex !== -1) {
              updatedContacts[contactIndex] = {
                ...updatedContacts[contactIndex],
                status: result.isValid ? "valid" : "invalid",
                error: result.isValid ? undefined : result.reason,
                formatted: result.isValid ? result.formatted : undefined,
              };
            }
          });
        }

        setContacts(updatedContacts);
        setValidating(false);

        contactsToInsert = updatedContacts
          .filter((c) => c.status === "valid" && c.formatted)
          .map((c) => ({
            user_id: user.id,
            name: c.name,
            phone: c.formatted!,
            import_batch_id: crypto.randomUUID(),
          }));
      }

      if (contactsToInsert.length === 0) {
        toast({
          title: "Nenhum contato válido",
          description: "Nenhum contato passou na validação",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert em batches de 500 para evitar timeout
      const BATCH_SIZE = 500;
      let inserted = 0;
      
      for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
        const batch = contactsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) throw error;
        inserted += batch.length;
        
        // Atualiza progresso
        if (contactsToInsert.length > BATCH_SIZE) {
          toast({
            title: "Importando...",
            description: `${inserted} de ${contactsToInsert.length} contatos inseridos`,
          });
        }
      }

      const invalidCount = contacts.filter((c) => c.status === "invalid").length;

      toast({
        title: "Importação concluída com sucesso!",
        description: `${contactsToInsert.length} contatos importados! ${
          invalidCount > 0 ? `${invalidCount} contatos inválidos foram ignorados.` : ""
        }`,
      });

      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      setTimeout(() => {
        setFile(null);
        setContacts([]);
        setColumnMapping(null);
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
    }
  };

  const handleCancel = () => {
    setFile(null);
    setContacts([]);
    setColumnMapping(null);
    onOpenChange?.(false);
  };

  const validCount = contacts.filter((c) => c.status === "valid").length;
  const pendingCount = contacts.filter((c) => c.status === "pending").length;
  const invalidCount = contacts.filter((c) => c.status === "invalid").length;

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

          {/* Parsing Status */}
          {parsing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Processando arquivo...</AlertDescription>
            </Alert>
          )}

          {/* Statistics */}
          {contacts.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">{contacts.length}</div>
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
                    <div className="text-xs text-muted-foreground">Válidos</div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="font-semibold">{invalidCount}</div>
                    <div className="text-xs text-muted-foreground">Inválidos</div>
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
          {contacts.length > 0 && (
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
                    {contacts.map((contact, index) => (
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
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar {validCount + pendingCount > 0 && `(${validCount + pendingCount})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
