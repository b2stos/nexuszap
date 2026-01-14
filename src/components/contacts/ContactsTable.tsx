import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Search, Trash, Loader2, ChevronDown } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useContactsCount, useContactsPage } from "@/hooks/useContactsPaginated";

const PAGE_SIZE = 50;

export function ContactsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Get total count (real count, not limited)
  const { data: totalCount = 0 } = useContactsCount();
  
  // Get current page of contacts
  const { data: pageData, refetch, isLoading } = useContactsPage(currentPage, PAGE_SIZE, searchTerm);
  
  const contacts = pageData?.contacts || [];
  const displayCount = searchTerm ? pageData?.totalCount || 0 : totalCount;
  const hasMore = pageData?.hasMore || false;
  const totalPages = Math.ceil(displayCount / PAGE_SIZE);
  
  // Handle page change
  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore]);
  
  // Reset page when search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Contato excluído",
        description: "O contato foi removido com sucesso.",
      });
      refetch();
    }
  };

  const handleDeleteAll = async () => {
    if (!contacts || contacts.length === 0) return;
    
    setIsDeleting(true);
    const { error } = await supabase
      .from("contacts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all rows

    setIsDeleting(false);

    if (error) {
      toast({
        title: "Erro ao excluir contatos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Todos os contatos excluídos",
        description: `${contacts.length} contatos foram removidos com sucesso.`,
      });
      refetch();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Show real total count */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Total: <strong className="text-foreground">{displayCount.toLocaleString('pt-BR')}</strong>
          </div>
          
          {totalCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash className="h-4 w-4" />
                  Excluir Todos ({totalCount.toLocaleString('pt-BR')})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir todos os contatos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso irá excluir permanentemente{" "}
                    <strong>{totalCount.toLocaleString('pt-BR')} contatos</strong> da sua lista.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAll}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Excluindo..." : "Sim, excluir todos"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        
        {/* Pagination info */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
            <span>
              Mostrando {Math.min((currentPage + 1) * PAGE_SIZE, displayCount)} de {displayCount.toLocaleString('pt-BR')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
              >
                Início
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                Anterior
              </Button>
              <span className="px-2 py-1">
                Página {currentPage + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Carregando contatos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : null}
            {contacts?.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>
                  {new Date(contact.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
