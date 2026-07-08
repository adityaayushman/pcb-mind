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

export interface DefectPrediction {
  id: string;
  defect_type: string;
  component_label: string | null;
  bounding_box: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface Inspection {
  id: string;
  status: "queued" | "processing" | "passed" | "failed" | "error";
  image_url: string;
  annotated_image_url: string | null;
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

export const api = {
  getDashboard: () => apiGet<DashboardStats>("/api/dashboard"),
  listInspections: () => apiGet<Inspection[]>("/api/inspections"),
  getInspection: (id: string) => apiGet<Inspection>(`/api/inspections/${id}`),
  createInspection: (templateId: string, goldenPcbId: string | undefined, file: File) => {
    const form = new FormData();
    form.append("template_id", templateId);
    if (goldenPcbId) form.append("golden_pcb_id", goldenPcbId);
    form.append("file", file);
    return apiPostForm<Inspection>("/api/inspections", form);
  },
  listTemplates: () => apiGet<{ id: string; name: string; description: string | null }[]>(
    "/api/pcb-templates"
  ),
};
