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
import { CompetitorScore } from "./CompetitorScore";
import { ExternalLink, Search } from "lucide-react";

interface SerpResult {
  position: number | null;
  createdAt: Date;
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  serpResults: SerpResult[];
}

interface CompetitorsColumnProps {
  competitors: Competitor[];
  orgSlug: string;
  websiteId: string;
}

export function CompetitorsColumn({ competitors, orgSlug, websiteId }: CompetitorsColumnProps) {
  const [filter, setFilter] = useState("");

  const filteredCompetitors = useMemo(() => {
    return competitors.filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.url.toLowerCase().includes(filter.toLowerCase())
    );
  }, [competitors, filter]);

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Concurrents ({filteredCompetitors.length})
          </CardTitle>
          <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/competitors`}>
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
                <TableHead>Nom</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-center w-[80px]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompetitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                    {filter ? "Aucun résultat" : "Aucun concurrent"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompetitors.map((competitor) => (
                  <TableRow
                    key={competitor.id}
                    className="cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/competitors/${competitor.id}`}
                  >
                    <TableCell className="py-2">
                      <div className="text-xs font-medium">{competitor.name}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <a
                        href={competitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {competitor.url.replace(/^https?:\/\/(www\.)?/, '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <CompetitorScore
                        orgSlug={orgSlug}
                        websiteId={websiteId}
                        competitorId={competitor.id}
                        competitorUrl={competitor.url}
                      />
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
