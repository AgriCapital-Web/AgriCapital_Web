import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, X, Upload, FileText } from "lucide-react";


interface FileUploadVisualProps {
  label: string;
  field: string;
  accept?: string;
  required?: boolean;
  currentFile?: File | null;
  currentPreview?: string;
  onFileChange: (field: string, file: File | null, preview: string) => void;
}

export const FileUploadVisual = ({
  label,
  field,
  accept = "image/jpeg,image/png,application/pdf",
  required = false,
  currentFile,
  currentPreview,
  onFileChange,
}: FileUploadVisualProps) => {
  const [preview, setPreview] = useState<string>(currentPreview || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep preview in sync when parent restores draft / navigates steps
  useEffect(() => {
    setPreview(currentPreview || "");
  }, [currentPreview]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      setPreview(previewUrl);
      onFileChange(field, file, previewUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setPreview("");
    onFileChange(field, null, "");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const isImage = currentFile?.type?.startsWith("image/") || preview.startsWith("data:image");

  return (
    <div className="space-y-2">
      <Label>{label} {required && "*"}</Label>
      {!preview ? (
        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
            id={`upload-${field}`}
          />
          <Label htmlFor={`upload-${field}`} className="cursor-pointer">
            <div className="space-y-2">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Cliquer pour sélectionner un fichier
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, PDF max 10MB
              </p>
            </div>
          </Label>
        </div>
      ) : (
        <div className="relative border rounded-lg p-4">
          {isImage ? (
            <img
              src={preview}
              alt="Aperçu"
              className="w-full h-48 object-contain rounded"
            />
          ) : (
            <div className="flex items-center justify-center h-48 bg-muted rounded">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-primary mb-2" />
                <p className="text-sm font-medium">{currentFile?.name || "Document PDF"}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-3 justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(preview, "_blank")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Visualiser
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={clearFile}
            >
              <X className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadVisual;
