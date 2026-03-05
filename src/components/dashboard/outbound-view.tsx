"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, PlayCircle, PhoneCall, MessageSquare, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  zip: string;
  service_interest: string;
  notes: string;
  status: "Not contacted" | "Texted" | "Called" | "Scheduled" | "Won" | "Lost";
};

export function OutboundView() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [importing, setImporting] = useState(false);
  const [runningSequence, setRunningSequence] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const counts = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const row of rows) obj[row.status] = (obj[row.status] || 0) + 1;
    return obj;
  }, [rows]);

  async function handleUpload(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        showToast("No valid rows in CSV");
        setImporting(false);
        return;
      }

      const apiRows = parsed.map((row) => ({
        name: row.name,
        phone: row.phone,
        email: row.email,
        service_type: row.service_interest,
        city: "",
        state: "NY",
        postal_code: row.zip,
        tags: [row.service_interest]
      }));

      const res = await fetch("/api/outbound/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: apiRows })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(data.error || "Import failed");
        setImporting(false);
        return;
      }

      setRows((prev) => [
        ...parsed.map((row, idx) => ({
          ...row,
          id: `csv-${Date.now()}-${idx}`,
          status: "Not contacted" as const
        })),
        ...prev
      ]);
      showToast(`Imported ${parsed.length} contacts`);
    } catch {
      showToast("Could not read CSV");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function startSequence() {
    if (rows.length === 0) {
      showToast("Import contacts first");
      return;
    }

    setRunningSequence(true);
    showToast("Sequence started");

    const queue = [...rows];
    for (let i = 0; i < queue.length; i += 1) {
      const status: Contact["status"] = i % 5 === 0 ? "Scheduled" : i % 4 === 0 ? "Called" : "Texted";
      await new Promise((resolve) => setTimeout(resolve, 140));
      setRows((prev) => prev.map((row) => (row.id === queue[i].id ? { ...row, status } : row)));
    }

    setRunningSequence(false);
    showToast("Sequence simulation complete");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound Prospecting"
        subtitle="Upload contacts, launch sequence simulation, and move prospects to booked jobs."
        actions={
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button size="lg" variant="secondary" onClick={() => inputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
            <Button size="lg" onClick={startSequence} disabled={runningSequence || rows.length === 0}>
              <PlayCircle className="h-4 w-4" />
              Start Sequence
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Status</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {[
            "Not contacted",
            "Texted",
            "Called",
            "Scheduled",
            "Won",
            "Lost"
          ].map((key) => (
            <Badge key={key} variant={key === "Scheduled" || key === "Won" ? "success" : "default"}>
              {key}: {counts[key] || 0}
            </Badge>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="dashboard-section-title text-semantic-text">Imported Contacts</h2>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-semantic-muted">Upload a CSV with fields: name, phone, email, zip, service_interest, notes</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Contact</TH>
                    <TH>ZIP</TH>
                    <TH>Service</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <TD>{row.name}</TD>
                      <TD>{row.phone || row.email || "-"}</TD>
                      <TD>{row.zip || "-"}</TD>
                      <TD>{row.service_interest || "General"}</TD>
                      <TD>
                        <Badge variant={row.status === "Scheduled" || row.status === "Won" ? "success" : "default"}>{row.status}</Badge>
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          {row.phone ? (
                            <a href={`tel:${row.phone}`}>
                              <Button size="sm" variant="secondary"><PhoneCall className="h-4 w-4" />Call</Button>
                            </a>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const text = `Hi ${row.name}, this is Service Butler. We have an opening for ${row.service_interest || "service"}.`;
                              try {
                                await navigator.clipboard.writeText(text);
                                showToast("Text template copied");
                              } catch {
                                showToast("Could not copy text");
                              }
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />Text
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: "Scheduled" } : item)));
                              showToast("Marked scheduled");
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />Schedule
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function parseCsv(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const items: Contact[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = Object.fromEntries(header.map((key, idx) => [key, values[idx] || ""])) as Record<string, string>;
    const name = row.name || "";
    if (!name) continue;

    items.push({
      id: `tmp-${i}`,
      name,
      phone: row.phone || "",
      email: row.email || "",
      zip: row.zip || row.postal_code || "",
      service_interest: row.service_interest || row.service_type || "general",
      notes: row.notes || "",
      status: "Not contacted"
    });
  }

  return items;
}
