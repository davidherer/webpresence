"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

interface AIReport {
  id: string;
  type: string;
  title: string;
  createdAt: Date;
}

interface ReportsColumnProps {
  reports: AIReport[];
  orgSlug: string;
  websiteId: string;
}

export function ReportsColumn({ reports, orgSlug, websiteId }: ReportsColumnProps) {
  const [filter, setFilter] = useState("");

  const filteredReports = useMemo(() => {
    return reports.filter(r =>
      r.title.toLowerCase().includes(filter.toLowerCase()) ||
      r.type.toLowerCase().includes(filter.toLowerCase())
    );
  }, [reports, filter]);

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Rapports ({filteredReports.length})
          </CardTitle>
          <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/reports`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Tout voir
            </Button>
          </Link>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                    {filter ? "Aucun résultat" : "Aucun rapport"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/reports/${report.id}`}
                  >
                    <TableCell className="py-2">
                      <span className="text-xs">
                        {report.type === "initial_analysis"
                          ? "Initial"
                          : report.type === "periodic_recap"
                          ? "Périodique"
                          : "Concurrent"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-xs font-medium truncate">{report.title}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
