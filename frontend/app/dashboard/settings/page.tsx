"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { api, Profile } from "@/lib/api";
import { PageContainer } from "@/components/common/PageContainer";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  qa_engineer: "QA Engineer",
  operator: "Operator",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    api
      .getMe()
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name ?? "");
        setOrgName(p.organization_name ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your account"));
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile(fullName.trim());
      setProfile(updated);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveOrg() {
    setSavingOrg(true);
    try {
      const updated = await api.updateOrganization(orgName.trim());
      setProfile(updated);
      toast.success("Organization updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update organization");
    } finally {
      setSavingOrg(false);
    }
  }

  const isAdmin = profile?.role === "admin";

  return (
    <PageContainer width="md">
      <SectionHeading
        eyebrow="Account"
        title="Settings"
        description="Manage your profile and organization details."
      />

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!profile && !error && (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[180px]" />
        </div>
      )}

      {profile && (
        <div className="mt-8 space-y-6">
          <Card>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-medium">Profile</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="text-sm text-muted-foreground">Full name</label>
                <Input
                  className="mt-1.5"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <Input className="mt-1.5" value={profile.email ?? ""} disabled />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Role</label>
                <Input className="mt-1.5" value={ROLE_LABEL[profile.role] ?? profile.role} disabled />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={saveProfile}
                  disabled={savingProfile || !fullName.trim() || fullName.trim() === (profile.full_name ?? "")}
                >
                  <Save /> {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-medium">Organization</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="text-sm text-muted-foreground">Organization name</label>
                <Input
                  className="mt-1.5"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isAdmin}
                />
                {!isAdmin && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Only admins can rename the organization.
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveOrg}
                    disabled={savingOrg || !orgName.trim() || orgName.trim() === (profile.organization_name ?? "")}
                  >
                    <Save /> {savingOrg ? "Saving…" : "Save organization"}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
