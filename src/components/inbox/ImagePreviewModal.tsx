/**
 * ImagePreviewModal Component
 * 
 * Modal para visualização de imagens em tela cheia com zoom
 */

import { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImagePreviewModalProps {
  imageUrl: string;
  altText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewModal({
  imageUrl,
  altText = 'Imagem',
  open,
  onOpenChange,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = altText || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleReset();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none">
        <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-sm font-normal">
              {altText}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="text-white hover:bg-white/20 h-8 w-8"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-xs min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="text-white hover:bg-white/20 h-8 w-8"
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div 
          className="flex items-center justify-center overflow-auto min-h-[300px] p-8"
          onClick={() => zoom === 1 && onOpenChange(false)}
        >
          <img
            src={imageUrl}
            alt={altText}
            className={cn(
              "max-w-full max-h-[80vh] object-contain transition-transform duration-200",
              zoom !== 1 && "cursor-move"
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
