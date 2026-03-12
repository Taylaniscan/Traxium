"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ImportExportPanel() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleImport(formData: FormData) {
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    setMessage(response.ok ? `Imported ${result.count} saving cards.` : result.error ?? "Import failed.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Excel Export</CardTitle>
          <CardDescription>Download the current saving card portfolio as an Excel report.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/export">
            <Button>Download Workbook</Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excel Import</CardTitle>
          <CardDescription>Upload `.xlsx` files with aligned saving card columns for bulk creation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={handleImport} className="space-y-4">
            <input type="file" name="file" accept=".xlsx,.xls" required />
            <Button type="submit">Import Workbook</Button>
          </form>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
