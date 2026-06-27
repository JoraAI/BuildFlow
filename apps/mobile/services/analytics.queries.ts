/**
 * BuildFlow — React Query hooks for the Owner Analytics Dashboard.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface AnalyticsKpis {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  totalRevenue: number;
  totalOutstanding: number;
  totalBudget: number;
  avgProgress: number;
}

export interface ProjectPin {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: string;
  progress: number;
}

export interface RevenueTargetPoint {
  month: string;
  revenue: number;
  target: number;
}

export interface ProjectProgressRow {
  id: string;
  name: string;
  progress: number;
  budget: number;
}

export interface TeamProductivityRow {
  userId: string;
  name: string;
  reportsCount: number;
  role: string;
}

export interface CashFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface BudgetBurnRow {
  projectId: string;
  projectName: string;
  budget: number;
  spent: number;
  burnPct: number;
}

export interface EstimationAccuracyRow {
  projectId: string;
  projectName: string;
  estimated: number;
  actual: number;
  variancePct: number;
  accuracyScore: number;
}

export interface MaterialTrendPoint {
  date: string;
  rate: number;
}

export interface MaterialTrend {
  resourceId: string;
  name: string;
  unit: string;
  points: MaterialTrendPoint[];
}

export interface AnalyticsDashboard {
  kpis: AnalyticsKpis;
  projectPins: ProjectPin[];
  revenueVsTarget: RevenueTargetPoint[];
  projectProgress: ProjectProgressRow[];
  teamProductivity: TeamProductivityRow[];
  cashFlowForecast: CashFlowPoint[];
  budgetBurn: BudgetBurnRow[];
  estimationAccuracy: EstimationAccuracyRow[];
  materialTrends: MaterialTrend[];
}

export function useAnalyticsDashboard() {
  return useQuery<AnalyticsDashboard>({
    queryKey: ['analytics', 'dashboard'] as const,
    queryFn: () => apiFetch<AnalyticsDashboard>('/analytics/dashboard'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
