"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SerpChartProps {
  orgSlug: string;
  websiteId: string;
  queryId: string;
}

interface ChartDataPoint {
  date: string;
  position: number | null;
}

interface Stats {
  currentPosition: number | null;
  change: number | null;
  trend: "up" | "down" | "stable" | "absent";
}

export function SerpChart({ orgSlug, websiteId, queryId }: SerpChartProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [query, setQuery] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/serp?days=${days}`
      );
      const json = await res.json();

      if (json.success) {
        setChartData(json.data.chartData);
        setQuery(json.data.query);
        setStats(json.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch SERP data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orgSlug, websiteId, queryId, days]);

  const triggerAnalysis = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/serp`,
        { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }) // Force cancel any pending jobs
        }
      );
      const json = await res.json();

      if (json.success) {
        console.log("[SerpChart] Analysis triggered:", json.data);
        // Refetch data after a delay to let analysis complete
        setTimeout(fetchData, 3000);
      } else {
        console.error("[SerpChart] Failed to trigger analysis:", json.error);
      }
    } catch (error) {
      console.error("Failed to trigger SERP analysis:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Évolution du positionnement</CardTitle>
            <CardDescription>
              Suivi de la position pour la requête "{query}"
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerAnalysis}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Analyser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">Aucune donnée de positionnement disponible.</p>
            <Button onClick={triggerAnalysis} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Lancer une analyse SERP
            </Button>
          </div>
        ) : (
          <>
            {/* Stats summary */}
            {stats && (
              <div className="flex items-center gap-3 p-4 rounded-lg border mb-6">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={query}>
                    {query}
                  </p>
                  <div className="flex items-center gap-2">
                    {stats.currentPosition === null ? (
                      <span className="text-2xl font-bold text-orange-500">Absent</span>
                    ) : (
                      <span className="text-2xl font-bold">#{stats.currentPosition}</span>
                    )}
                    {stats.trend === "up" && (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    )}
                    {stats.trend === "down" && (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    {stats.trend === "stable" && (
                      <Minus className="w-5 h-5 text-gray-400" />
                    )}
                    {stats.trend === "absent" && (
                      <span className="text-sm text-orange-500">Non classé</span>
                    )}
                    {stats.change !== null && stats.change !== 0 && (
                      <span
                        className={`text-sm font-medium ${
                          stats.change > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {stats.change > 0 ? "+" : ""}
                        {stats.change} positions
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    reversed
                    domain={[1, "auto"]}
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "Position",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatDate(label as string)}
                    formatter={(value) => [
                      value === null || value === undefined ? "Absent" : `#${value}`,
                      "Position"
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="position"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
