"use client";

import { useRef, useState } from "react";
import { CloudUpload, FileText, FolderOpen, Trash2 } from "lucide-react";
import {
  ALLOWED_EVIDENCE_EXTENSIONS,
  MAX_EVIDENCE_FILE_SIZE,
  formatEvidenceFileSize,
  isAllowedEvidenceFileName
} from "@/lib/evidence-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type UploadedEvidenceFile = {
  id?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  progress?: number;
  status?: "uploading" | "uploaded" | "error";
  error?: string;
};

export function EvidenceUploader({
  files,
  onChange,
  onError
}: {
  files: UploadedEvidenceFile[];
  onChange: (files: UploadedEvidenceFile[]) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);

  return (
    <>
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Evidence Upload</CardTitle>
              <CardDescription>Upload contracts, quotes, confirmations, and spreadsheets up to 25 MB each.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Pick Files
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowDriveModal(true)}>
                Upload from Google Drive
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={ALLOWED_EVIDENCE_EXTENSIONS.join(",")}
            onChange={(event) => {
              if (event.target.files) {
                void performUploads(event.target.files, files, onChange, onError);
                event.target.value = "";
              }
            }}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void performUploads(event.dataTransfer.files, files, onChange, onError);
            }}
            className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
              isDragging ? "border-[var(--primary)] bg-[var(--muted)]" : "border-[var(--border)] bg-white/60"
            }`}
          >
            <CloudUpload className="mx-auto h-8 w-8 text-[var(--primary)]" />
            <p className="mt-3 text-sm font-semibold">Drag and drop evidence files here</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Supported: PDF, JPG, JPEG, PNG, XLS, XLSX, DOC, DOCX, PPT, PPTX
            </p>
          </div>

          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={file.id ?? `${file.fileName}-${index}`} className="rounded-2xl bg-[var(--muted)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
                    <div>
                      <p className="text-sm font-semibold">{file.fileName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {file.fileType} · {formatEvidenceFileSize(file.fileSize)}
                      </p>
                      {file.status === "error" ? <p className="mt-1 text-xs text-red-600">{file.error}</p> : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {file.status === "uploading" ? (
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${file.progress ?? 0}%` }} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showDriveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Google Drive Upload</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Google Drive integration will be available in future version.
            </p>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setShowDriveModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

async function performUploads(
  fileList: FileList,
  existingFiles: UploadedEvidenceFile[],
  onChange: (files: UploadedEvidenceFile[]) => void,
  onError: (message: string | null) => void
) {
  let currentFiles = [...existingFiles];

  for (const file of Array.from(fileList)) {
    if (!isAllowedEvidenceFileName(file.name)) {
      onError(`Unsupported file type for ${file.name}.`);
      continue;
    }

    if (file.size > MAX_EVIDENCE_FILE_SIZE) {
      onError(`${file.name} exceeds the 25 MB limit.`);
      continue;
    }

    const tempId = `${file.name}-${Math.random().toString(36).slice(2)}`;
    const uploadEntry: UploadedEvidenceFile = {
      id: tempId,
      fileName: file.name,
      fileUrl: "",
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      progress: 0,
      status: "uploading"
    };

    currentFiles = [...currentFiles, uploadEntry];
    onChange(currentFiles);

    try {
      const uploaded = await uploadSingleFile(file, (progress) => {
        currentFiles = currentFiles.map((item) => (item.id === tempId ? { ...item, progress } : item));
        onChange(currentFiles);
      });

      currentFiles = currentFiles.map((item) =>
        item.id === tempId ? { ...uploaded, id: item.id, status: "uploaded", progress: 100 } : item
      );
      onChange(currentFiles);
    } catch (error) {
      currentFiles = currentFiles.map((item) =>
        item.id === tempId
          ? {
              ...item,
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed."
            }
          : item
      );
      onChange(currentFiles);
      onError(error instanceof Error ? error.message : "Upload failed.");
    }
  }
}

function uploadSingleFile(file: File, onProgress: (progress: number) => void) {
  return new Promise<UploadedEvidenceFile>((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/evidence");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = JSON.parse(xhr.responseText || "{}").error ?? "Upload failed.";
        reject(new Error(message));
        return;
      }

      const result = JSON.parse(xhr.responseText) as { files: UploadedEvidenceFile[] };
      resolve(result.files[0]);
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed.")));
    xhr.send(formData);
  });
}
