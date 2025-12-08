import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Search, Trash } from "lucide-react";
import { useState } from "react";
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

export function ContactsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: contacts, refetch } = useQuery({
    queryKey: ["contacts", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {contacts && contacts.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash className="h-4 w-4" />
                  Excluir Todos ({contacts.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir todos os contatos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso irá excluir permanentemente{" "}
                    <strong>{contacts.length} contatos</strong> da sua lista.
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
            {contacts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            )}
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
