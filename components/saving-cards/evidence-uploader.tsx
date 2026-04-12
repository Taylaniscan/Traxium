"use client";

import { useRef, useState } from "react";
import { CloudUpload, FileText, FolderOpen, Trash2 } from "lucide-react";
import {
  ALLOWED_EVIDENCE_EXTENSIONS,
  MAX_EVIDENCE_FILE_SIZE,
  formatEvidenceFileSize,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type UploadedEvidenceFile = {
  id?: string;
  fileName: string;
  downloadUrl?: string;
  fileSize: number;
  fileType: string;
  progress?: number;
  status?: "uploading" | "uploaded" | "error";
  error?: string;
};

export function EvidenceUploader({
  savingCardId,
  files,
  onChange,
  onError,
}: {
  savingCardId: string;
  files: UploadedEvidenceFile[];
  onChange: (files: UploadedEvidenceFile[]) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const uploadedCount = files.filter((file) => file.status === "uploaded" || (!file.status && file.downloadUrl)).length;
  const errorCount = files.filter((file) => file.status === "error").length;

  return (
    <>
      <Card className="overflow-hidden rounded-3xl border border-[var(--border)] shadow-sm">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                Evidence Register
              </p>
              <CardTitle>Evidence Upload</CardTitle>
              <CardDescription>
                Upload contracts, quotes, confirmations, and spreadsheets up to 25 MB each. Every file becomes part of the operational audit trail for this record.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">{files.length} file</Badge>
              {uploadedCount ? <Badge tone="emerald">{uploadedCount} linked</Badge> : null}
              {errorCount ? <Badge tone="error">{errorCount} issue</Badge> : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/55 px-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Record attachments
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Allowed: {ALLOWED_EVIDENCE_EXTENSIONS.join(", ").toUpperCase()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => inputRef.current?.click()}>
                <CloudUpload className="mr-2 h-4 w-4" />
                Pick Files
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDriveModal(true)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Upload from Google Drive
              </Button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                void performUploads(
                  savingCardId,
                  event.target.files,
                  files,
                  onChange,
                  onError,
                );
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
              void performUploads(
                savingCardId,
                event.dataTransfer.files,
                files,
                onChange,
                onError,
              );
            }}
            className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? "border-[var(--primary)] bg-[var(--surface-elevated)]"
                : "border-[var(--border)] bg-[var(--surface)]"
            }`}
          >
            <CloudUpload className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium">Drag and drop evidence files here</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Supported: PDF, JPG, JPEG, PNG, XLS, XLSX, DOC, DOCX, PPT, PPTX
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Files are linked directly to this saving card and remain visible in the evidence register.
            </p>
          </div>

          <div className="space-y-3">
            {files.length ? (
              files.map((file, index) => (
                <div
                  key={file.id ?? `${file.fileName}-${index}`}
                  className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)]">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {file.fileName}
                      </p>
                      <Badge tone={getFileStatusTone(file)}>
                        {getFileStatusLabel(file)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                      <span>{file.fileType}</span>
                      <span>{formatEvidenceFileSize(file.fileSize)}</span>
                      <span>{file.downloadUrl ? "Linked to record" : "Awaiting upload completion"}</span>
                    </div>

                    {file.downloadUrl ? (
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-xs font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                      >
                        Open file
                      </a>
                    ) : null}

                    {file.status === "error" ? (
                      <div className="rounded-xl border border-[rgba(161,59,45,0.18)] bg-[rgba(161,59,45,0.08)] px-3 py-2 text-xs text-[var(--risk)]">
                        {file.error}
                      </div>
                    ) : null}

                    {file.status === "uploading" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
                          <span>Uploading to evidence register</span>
                          <span>{file.progress ?? 0}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] transition-all"
                            style={{ width: `${file.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-start justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() =>
                        onChange(files.filter((_, fileIndex) => fileIndex !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/55 px-4 py-8 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  No evidence linked yet
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Upload contracts, quotes, or supporting spreadsheets so reviewers can audit the case without leaving the record.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showDriveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Google Drive Upload</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Google Drive integration will be available in a future version.
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDriveModal(false)}
              >
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
  savingCardId: string,
  fileList: FileList,
  existingFiles: UploadedEvidenceFile[],
  onChange: (files: UploadedEvidenceFile[]) => void,
  onError: (message: string | null) => void,
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
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      progress: 0,
      status: "uploading",
    };

    currentFiles = [...currentFiles, uploadEntry];
    onChange(currentFiles);

    try {
      const uploaded = await uploadSingleFile(savingCardId, file, (progress) => {
        currentFiles = currentFiles.map((item) =>
          item.id === tempId ? { ...item, progress } : item,
        );
        onChange(currentFiles);
      });

      currentFiles = currentFiles.map((item) =>
        item.id === tempId
          ? {
              ...uploaded,
              id: item.id,
              status: "uploaded",
              progress: 100,
            }
          : item,
      );

      onChange(currentFiles);
    } catch (error) {
      currentFiles = currentFiles.map((item) =>
        item.id === tempId
          ? {
              ...item,
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed.",
            }
          : item,
      );
      onChange(currentFiles);
      onError(error instanceof Error ? error.message : "Upload failed.");
    }
  }
}

function uploadSingleFile(
  savingCardId: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadedEvidenceFile> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("savingCardId", savingCardId);
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/evidence");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const message =
          JSON.parse(xhr.responseText || "{}").error ?? "Upload failed.";
        reject(new Error(message));
        return;
      }

      const result = JSON.parse(xhr.responseText) as {
        files: UploadedEvidenceFile[];
      };

      resolve(result.files[0]);
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed.")));
    xhr.send(formData);
  });
}

function getFileStatusLabel(file: UploadedEvidenceFile) {
  if (file.status === "error") {
    return "Needs attention";
  }

  if (file.status === "uploading") {
    return "Uploading";
  }

  return "On record";
}

function getFileStatusTone(file: UploadedEvidenceFile): "emerald" | "amber" | "error" {
  if (file.status === "error") {
    return "error";
  }

  if (file.status === "uploading") {
    return "amber";
  }

  return "emerald";
}
