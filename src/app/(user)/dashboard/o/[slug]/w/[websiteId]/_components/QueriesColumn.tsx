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
import { TrendingUp, TrendingDown, Minus, Search } from "lucide-react";

interface SerpResult {
  position: number | null;
  createdAt: Date;
}

interface SearchQuery {
  id: string;
  query: string;
  description: string | null;
  competitionLevel: "HIGH" | "LOW";
  serpResults: SerpResult[];
  _count: {
    aiSuggestions: number;
  };
}

interface QueriesColumnProps {
  queries: SearchQuery[];
  orgSlug: string;
  websiteId: string;
}

const getTrend = (serpResults: { position: number | null }[]) => {
  if (serpResults.length < 2) return null;
  const current = serpResults[0]?.position;
  const previous = serpResults[1]?.position;
  if (current === null || previous === null) return null;
  return previous - current;
};

const getTrendIcon = (trend: number | null) => {
  if (trend === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
  if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

export function QueriesColumn({ queries, orgSlug, websiteId }: QueriesColumnProps) {
  const [filter, setFilter] = useState("");

  const filteredQueries = useMemo(() => {
    return queries.filter(q =>
      q.query.toLowerCase().includes(filter.toLowerCase()) ||
      (q.description?.toLowerCase() || "").includes(filter.toLowerCase())
    );
  }, [queries, filter]);

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Requêtes ({filteredQueries.length})
          </CardTitle>
          <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/queries`}>
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
                <TableHead className="w-[60%]">Requête</TableHead>
                <TableHead className="text-center">Position</TableHead>
                <TableHead className="text-center w-[60px]">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                    {filter ? "Aucun résultat" : "Aucune requête"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQueries.map((query) => {
                  const latestPosition = query.serpResults[0]?.position;
                  const trend = getTrend(query.serpResults);
                  return (
                    <TableRow
                      key={query.id}
                      className="cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/queries/${query.id}`}
                    >
                      <TableCell className="py-2">
                        <div className="text-xs font-medium truncate">{query.query}</div>
                        {query.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {query.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className="text-xs font-semibold">
                          {latestPosition !== null && latestPosition !== undefined && latestPosition > 0
                            ? `#${latestPosition}`
                            : query.serpResults.length > 0
                              ? <span className="text-orange-500">-</span>
                              : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        {getTrendIcon(trend)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
