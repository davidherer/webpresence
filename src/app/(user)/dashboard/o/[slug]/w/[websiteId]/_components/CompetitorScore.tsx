"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface CompetitorScoreProps {
  orgSlug: string;
  websiteId: string;
  competitorId: string;
  competitorUrl: string;
}

interface Score {
  better: number;
  worse: number;
  total: number;
}

export function CompetitorScore({ 
  orgSlug, 
  websiteId, 
  competitorId, 
  competitorUrl 
}: CompetitorScoreProps) {
  const [score, setScore] = useState<Score | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/competitors/${competitorId}/score`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setScore(json.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch competitor score:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [orgSlug, websiteId, competitorId, competitorUrl]);

  if (loading) {
    return <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  if (!score || score.total === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const netScore = score.better - score.worse;
  const isPositive = netScore > 0;
  const isNegative = netScore < 0;

  return (
    <div className="flex items-center gap-1">
      <span className={`font-semibold text-lg ${
        isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"
      }`}>
        {netScore > 0 ? "+" : ""}{netScore}
      </span>
      {isPositive && <TrendingUp className="w-4 h-4 text-green-600" />}
      {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
      {!isPositive && !isNegative && <Minus className="w-4 h-4 text-muted-foreground" />}
    </div>
  );
}
