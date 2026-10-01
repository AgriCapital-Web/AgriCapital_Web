import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  currentFile?: string;
  onRemove?: () => void;
  label?: string;
  disabled?: boolean;
}

const FileUpload = ({
  onFileSelect,
  accept = "image/*,application/pdf",
  maxSize = 5 * 1024 * 1024, // 5MB
  currentFile,
  onRemove,
  label = "Choisir un fichier",
  disabled = false,
}: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");

    if (!file) return;

    if (file.size > maxSize) {
      setError(`Le fichier est trop volumineux (max: ${maxSize / 1024 / 1024}MB)`);
      return;
    }

    onFileSelect(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setError("");
    onRemove?.();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      
      {currentFile ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
          <File className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-sm truncate">{currentFile}</span>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          {label}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

export default FileUpload;
