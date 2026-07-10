"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { api, TeamMember, Role } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  qa_engineer: "QA Engineer",
  operator: "Operator",
};

const ROLE_TINT: Record<Role, string> = {
  admin: "bg-primary/15 text-primary",
  qa_engineer: "bg-severity-major/15 text-severity-major",
  operator: "bg-muted text-muted-foreground",
};

function initials(name: string | null, email: string | null) {
  const source = name || email || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTeam()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your team"));
    api
      .getMe()
      .then((p) => setIsAdmin(p.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function changeRole(member: TeamMember, role: Role) {
    setSavingId(member.id);
    try {
      const updated = await api.updateMemberRole(member.id, role);
      setMembers((prev) => (prev ?? []).map((m) => (m.id === member.id ? updated : m)));
      toast.success(`${member.full_name ?? "Member"} is now ${ROLE_LABEL[role]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change role");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PageContainer width="lg">
      <SectionHeading
        eyebrow="Organization"
        title="Team"
        description="Everyone in your organization and the role that governs what they can do."
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!members && !error && (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      )}

      {members && (
        <Card className="mt-8 overflow-hidden">
          {members.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No team members found.</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-sm text-foreground">
                  {initials(m.full_name, m.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.full_name ?? "Unnamed"}
                    {m.is_self && <span className="ml-2 text-xs text-muted-foreground">You</span>}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{m.email ?? "—"}</p>
                </div>

                {isAdmin && !m.is_self ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m, v as Role)}
                    disabled={savingId === m.id}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TINT[m.role]}`}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </div>
            ))
          )}
        </Card>
      )}

      {members && isAdmin && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" /> As an admin, you can change any teammate&apos;s role. New
          teammates join by signing up with your organization.
        </p>
      )}
    </PageContainer>
  );
}
