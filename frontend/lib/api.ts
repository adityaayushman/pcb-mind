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

export interface PcbTemplate {
  id: string;
  name: string;
  description: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: "admin" | "qa_engineer" | "operator";
  organization_id: string | null;
}

export const api = {
  getDashboard: () => apiGet<DashboardStats>("/api/dashboard"),
  getMe: () => apiGet<Profile>("/api/auth/me"),
  listInspections: () => apiGet<Inspection[]>("/api/inspections"),
  getInspection: (id: string) => apiGet<Inspection>(`/api/inspections/${id}`),
  createInspection: (templateId: string, goldenPcbId: string | undefined, file: File) => {
    const form = new FormData();
    form.append("template_id", templateId);
    if (goldenPcbId) form.append("golden_pcb_id", goldenPcbId);
    form.append("file", file);
    return apiPostForm<Inspection>("/api/inspections", form);
  },
  getReportUrl: (id: string) => apiGet<{ report_url: string }>(`/api/inspections/${id}/report`),
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
};
