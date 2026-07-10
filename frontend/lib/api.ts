import { supabase } from "./supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: await authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers: await authHeader() });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

// Bare navigation (<a href>) can't attach the auth header, so authenticated
// file downloads (export, etc.) need to fetch + blob + trigger the download
// themselves rather than just linking straight at the endpoint.
export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type Severity = "critical" | "major" | "minor";

export interface DefectPrediction {
  id: string;
  defect_type: string;
  component_label: string | null;
  bounding_box: { x: number; y: number; width: number; height: number };
  confidence: number;
  severity: Severity;
  is_reference_match: boolean;
}

export interface Inspection {
  id: string;
  status: "queued" | "processing" | "passed" | "failed" | "error";
  image_url: string;
  annotated_image_url: string | null;
  heatmap_image_url: string | null;
  overall_confidence: number | null;
  defect_count: number;
  inference_time_ms: number | null;
  report_url: string | null;
  ai_summary: string | null;
  registration_status: string | null;
  validation_notes: string[];
  created_at: string;
  completed_at: string | null;
  predictions: DefectPrediction[];
}

export interface DashboardStats {
  total_inspections: number;
  passed: number;
  failed: number;
  defect_breakdown: Record<string, number>;
  recent: Inspection[];
}

export interface GoldenPcb {
  id: string;
  image_url: string;
  version: number;
  baseline_ready: boolean;
  created_at: string;
}

export interface PcbTemplate {
  id: string;
  name: string;
  description: string | null;
  golden_pcb: GoldenPcb | null;
}

export type Role = "admin" | "qa_engineer" | "operator";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  organization_id: string | null;
  organization_name: string | null;
}

export interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_self: boolean;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PeriodStats {
  total: number;
  passed: number;
  failed: number;
  pass_rate: number | null;
  avg_inference_time_ms: number | null;
}

export interface DailyTrendPoint {
  date: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number | null;
  avg_inference_time_ms: number | null;
}

export interface TopDefect {
  defect_type: string;
  count: number;
}

export interface AnalyticsOut {
  current_period: PeriodStats;
  previous_period: PeriodStats;
  daily_trend: DailyTrendPoint[];
  defect_trend: Record<string, string | number>[];
  top_defects: TopDefect[];
}

// Inspection creation returns as soon as the upload lands — the model runs
// afterward in the background (a cold instance can take 60-80s+, well past
// most client/proxy request timeouts), so callers poll this until the
// status leaves queued/processing rather than awaiting one long request.
async function pollInspection(
  id: string,
  { intervalMs = 2000, timeoutMs = 180_000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<Inspection> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const inspection = await apiGet<Inspection>(`/api/inspections/${id}`);
    if (inspection.status !== "queued" && inspection.status !== "processing") {
      return inspection;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Inspection is taking longer than expected — check back on the dashboard shortly");
}

export const api = {
  getDashboard: () => apiGet<DashboardStats>("/api/dashboard"),
  getMe: () => apiGet<Profile>("/api/auth/me"),
  listInspections: () => apiGet<Inspection[]>("/api/inspections"),
  getInspection: (id: string) => apiGet<Inspection>(`/api/inspections/${id}`),
  createInspection: async (templateId: string, goldenPcbId: string | undefined, file: File) => {
    const form = new FormData();
    form.append("template_id", templateId);
    if (goldenPcbId) form.append("golden_pcb_id", goldenPcbId);
    form.append("file", file);
    const inspection = await apiPostForm<Inspection>("/api/inspections", form);
    return pollInspection(inspection.id);
  },
  getReportUrl: (id: string) => apiGet<{ report_url: string }>(`/api/inspections/${id}/report`),
  getHeatmapUrl: (id: string) =>
    apiGet<{ heatmap_image_url: string | null }>(`/api/inspections/${id}/heatmap`),
  getAiSummary: (id: string) =>
    apiGet<{ ai_summary: string | null }>(`/api/inspections/${id}/ai-summary`),
  exportInspections: (format: "csv" | "xlsx") =>
    apiDownload(`/api/inspections/export?format=${format}`, `inspections.${format}`),
  listTemplates: () => apiGet<PcbTemplate[]>("/api/pcb-templates"),
  createTemplate: (name: string, description?: string) => {
    const form = new FormData();
    form.append("name", name);
    if (description) form.append("description", description);
    return apiPostForm<PcbTemplate>("/api/pcb-templates", form);
  },
  uploadGoldenPcb: (templateId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiPostForm<{ id: string; image_url: string }>(
      `/api/pcb-templates/${templateId}/golden`,
      form
    );
  },
  sendCopilotMessage: (message: string) =>
    apiPost<CopilotMessage>("/api/copilot/chat", { message }),
  getCopilotHistory: () => apiGet<CopilotMessage[]>("/api/copilot/messages"),
  clearCopilotHistory: () => apiDelete("/api/copilot/messages"),
  bootstrap: (full_name: string, organization_name: string) =>
    apiPost<Profile>("/api/auth/bootstrap", { full_name, organization_name }),
  updateProfile: (full_name: string) => apiPatch<Profile>("/api/auth/me", { full_name }),
  updateOrganization: (name: string) => apiPatch<Profile>("/api/auth/organization", { name }),
  getTeam: () => apiGet<TeamMember[]>("/api/team"),
  updateMemberRole: (memberId: string, role: Role) =>
    apiPatch<TeamMember>(`/api/team/${memberId}`, { role }),
  getAnalytics: (days: number, templateId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (templateId) params.set("template_id", templateId);
    return apiGet<AnalyticsOut>(`/api/analytics?${params.toString()}`);
  },
};
