"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components";
import { useRbac } from "@/context/RbacContext";
import {
  APPLICATION_ACTIONS,
  DATA_POLICY_ACTIONS,
  PERMISSION_ACTIONS,
  ROLE_ACTIONS,
  ROLE_PERMISSION_ACTIONS,
} from "@/shared/permissions/actions";

import { useApplicationData } from "@/features/application/hooks/useApplicationData";
import {
  ApplicationTab,
  ApplicationPageSkeleton,
  ApplicationNotFound,
  RolesTab,
  PermissionsTab,
  RolePermissionsTab,
  DataPoliciesTab,
  AgencyUsersTab,
} from "@/features/application/components";
import {
  TabId,
  TabDefinition,
} from "@/features/application/types";

const TAB_DEFINITIONS: TabDefinition[] = [
  { id: "application", label: "tabApplication", action: APPLICATION_ACTIONS.view },
  { id: "roles", label: "tabRoles", action: ROLE_ACTIONS.view },
  { id: "permissions", label: "tabPermissions", action: PERMISSION_ACTIONS.view },
  {
    id: "role-permissions",
    label: "tabRolePermissions",
    action: ROLE_PERMISSION_ACTIONS.view,
  },
  {
    id: "data-policies",
    label: "tabDataPolicies",
    action: DATA_POLICY_ACTIONS.view,
  },
];

export default function ApplicationDetailPage() {
  const t = useTranslations();
  const { can } = useRbac();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const applicationId = Number(params.id);

  // Application data hook
  const {
    app,
    form: appForm,
    loading,
    loadedOnce,
    saving,
    loadApp,
    saveApplication,
    setAppForm,
    reset: resetApp,
  } = useApplicationData(applicationId);

  // Tab state from URL
  const [tab, setTab] = useState<TabId>(() => {
    const tabParam = searchParams.get("tab");
    return (tabParam as TabId) || "application";
  });

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setTab(tabParam as TabId);
    } else {
      // Set default tab in URL if not present
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("tab", "application");
      router.push(`?${newParams.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  // Reset on application change
  useLayoutEffect(() => {
    resetApp();
    // Don't reset tab - let it be controlled by URL
  }, [applicationId, resetApp]);

  // Load application on mount
  useEffect(() => {
    loadApp();
  }, [applicationId]);

  // Filter visible tabs based on permissions
  const isAgent = app?.application_type === "agent";
  const visibleTabs = (
    isAgent
      ? [
          { id: "application" as TabId, label: "tabAgency", action: APPLICATION_ACTIONS.view },
          { id: "users" as TabId, label: "tabAgencyAdmins", action: APPLICATION_ACTIONS.view },
          // Agency: roles / permissions / role-permission mapping hidden.
          // ...TAB_DEFINITIONS.slice(1),
          // { id: "roles" as TabId, label: "tabRoles", action: ROLE_ACTIONS.view },
          // { id: "permissions" as TabId, label: "tabPermissions", action: PERMISSION_ACTIONS.view },
          // {
          //   id: "role-permissions" as TabId,
          //   label: "tabRolePermissions",
          //   action: ROLE_PERMISSION_ACTIONS.view,
          // },
          {
            id: "data-policies" as TabId,
            label: "tabAgencyDataPolicies",
            action: DATA_POLICY_ACTIONS.view,
          },
        ]
      : TAB_DEFINITIONS
  )
    .filter((item) => can(item.action))
    .map((item) => ({
      ...item,
      label: t(item.label),
    }));

  // Sync tab state with URL changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== tab) {
      setTab(tabParam as TabId);
    }
  }, [searchParams]);

  // Set default tab if current tab is not visible
  useEffect(() => {
    if (
      visibleTabs.length > 0 &&
      !visibleTabs.some((item) => item.id === tab)
    ) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);


  if (loading && !loadedOnce) {
    return <ApplicationPageSkeleton />;
  }

  if (!app) {
    return <ApplicationNotFound backHref={pathname.startsWith("/agencies") ? "/agencies" : "/applications"} />;
  }

  return (
    <div>
      <h1 className="text-[24px] font-bold text-black mb-4">{app.application_mnemonic}</h1>

      <Tabs
        tabs={visibleTabs}
        active={tab}
        onChange={(id) => {
          setTab(id as TabId);
          // Update URL with new tab
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set("tab", id);
          router.push(`?${newParams.toString()}`, { scroll: false });
        }}
      />

      <div style={{ display: tab === "application" ? "block" : "none" }}>
        <ApplicationTab
          app={app}
          appForm={appForm}
          saving={saving}
          setAppForm={setAppForm}
          saveApplication={saveApplication}
        />
      </div>

      {/* Agency: roles / permissions / mapping tabs hidden. */}
      {!isAgent && (
        <>
          <div style={{ display: tab === "roles" ? "block" : "none" }}>
            <RolesTab applicationId={applicationId} isActive={tab === "roles"} />
          </div>

          <div style={{ display: tab === "permissions" ? "block" : "none" }}>
            <PermissionsTab applicationId={applicationId} isActive={tab === "permissions"} />
          </div>

          <div style={{ display: tab === "role-permissions" ? "block" : "none" }}>
            <RolePermissionsTab applicationId={applicationId} isActive={tab === "role-permissions"} />
          </div>
        </>
      )}
      {/*
      <div style={{ display: tab === "roles" ? "block" : "none" }}>
        <RolesTab applicationId={applicationId} isActive={tab === "roles"} />
      </div>
      <div style={{ display: tab === "permissions" ? "block" : "none" }}>
        <PermissionsTab applicationId={applicationId} isActive={tab === "permissions"} />
      </div>
      <div style={{ display: tab === "role-permissions" ? "block" : "none" }}>
        <RolePermissionsTab applicationId={applicationId} isActive={tab === "role-permissions"} />
      </div>
      */}

      {isAgent && (
        <div style={{ display: tab === "users" ? "block" : "none" }}>
          <AgencyUsersTab agencyId={app.application_mnemonic} />
        </div>
      )}

      <div style={{ display: tab === "data-policies" ? "block" : "none" }}>
        <DataPoliciesTab
          applicationId={applicationId}
          apiUrl={app.api_url}
          isActive={tab === "data-policies"}
          isAgency={isAgent}
        />
      </div>

    </div>
  );
}
