import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, File, Image as ImageIcon, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MediaUploadProps {
  onMediaUploaded: (urls: string[]) => void;
  existingMedia?: string[];
}

export function MediaUpload({ onMediaUploaded, existingMedia = [] }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<string[]>(existingMedia);
  const { toast } = useToast();

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      return <Video className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
          'application/pdf'
        ];

        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Tipo de arquivo não permitido",
            description: `O arquivo ${file.name} não é suportado. Use imagens, vídeos ou PDFs.`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "Arquivo muito grande",
            description: `O arquivo ${file.name} excede o limite de 50MB.`,
            variant: "destructive",
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('campaign-media')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('campaign-media')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
      }

      const newMediaFiles = [...mediaFiles, ...uploadedUrls];
      setMediaFiles(newMediaFiles);
      onMediaUploaded(newMediaFiles);

      toast({
        title: "Upload concluído",
        description: `${uploadedUrls.length} arquivo(s) enviado(s) com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (url: string) => {
    try {
      // Extract file path from URL
      const urlParts = url.split('/campaign-media/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('campaign-media').remove([filePath]);
      }

      const newMediaFiles = mediaFiles.filter(media => media !== url);
      setMediaFiles(newMediaFiles);
      onMediaUploaded(newMediaFiles);

      toast({
        title: "Arquivo removido",
        description: "O arquivo foi removido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => document.getElementById('media-upload')?.click()}
          className="relative"
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Enviando..." : "Upload de Mídia"}
        </Button>
        <input
          id="media-upload"
          type="file"
          multiple
          accept="image/*,video/*,.pdf"
          onChange={handleUpload}
          className="hidden"
        />
        <p className="text-xs text-muted-foreground">
          Fotos, vídeos ou PDFs (máx. 50MB cada)
        </p>
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaFiles.map((url, index) => (
            <div
              key={index}
              className="relative group border rounded-lg p-3 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                {getFileIcon(url)}
                <span className="text-xs truncate flex-1">
                  {url.split('/').pop()?.split('-').pop()}
                </span>
              </div>
              
              {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                <img
                  src={url}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded"
                />
              )}
              
              {url.match(/\.(mp4|mov|avi|webm)$/i) && (
                <video
                  src={url}
                  className="w-full h-32 object-cover rounded"
                  controls={false}
                />
              )}

              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(url)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
