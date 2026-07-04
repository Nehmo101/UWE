"use client";

import * as React from "react";
import { NavIcon } from "@/src/components/ui/icon";
import { MailButton, Dot, EyebrowLabel } from "./mail-ui";
import {
  CATEGORY_COLORS,
  type MailAccountVM,
  type MailCategoryVM,
  type MailFolderVM,
  type MailPriorityVM,
  type MailView,
} from "./mail-types";

const ACCOUNT_DOT = ["var(--uwe-success)", "var(--uwe-accent)", "var(--uwe-info)"];

interface MailRailProps {
  accounts: MailAccountVM[];
  folders: MailFolderVM[];
  categories: MailCategoryVM[];
  activeCategory: MailPriorityVM["category"] | null;
  view: MailView;
  triageCount: number;
  onCompose: () => void;
  onOpenTriage: () => void;
  onSelectCategory: (category: MailPriorityVM["category"] | null) => void;
}

export function MailRail({
  accounts,
  folders,
  categories,
  activeCategory,
  view,
  triageCount,
  onCompose,
  onOpenTriage,
  onSelectCategory,
}: MailRailProps) {
  const triageActive = view === "triage";
  return (
    <div
      style={{
        width: 240,
        flex: "none",
        background: "var(--uwe-bg-elevated)",
        borderRight: "1px solid var(--uwe-border)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "14px 14px 10px" }}>
        <MailButton variant="accent" icon="pen-line" fullWidth onClick={onCompose}>
          Verfassen
        </MailButton>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 12px" }}>
        <EyebrowLabel>Konten</EyebrowLabel>
        {accounts.length === 0 ? (
          <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--uwe-fg-subtle)" }}>
            Kein Konto verbunden.
          </div>
        ) : (
          accounts.map((account, index) => (
            <div
              key={account.id}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 8 }}
            >
              <Dot color={account.ok ? ACCOUNT_DOT[index % ACCOUNT_DOT.length] : "var(--uwe-danger)"} />
              <span
                title={account.email}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: "var(--uwe-fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {account.email}
              </span>
            </div>
          ))
        )}

        <EyebrowLabel style={{ padding: "12px 8px 4px" }}>Ordner</EyebrowLabel>
        {folders.map((folder) => (
          <div
            key={folder.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 9px",
              borderRadius: 8,
              fontSize: 13,
              color: folder.active ? "var(--uwe-fg)" : "var(--uwe-fg-muted)",
              fontWeight: folder.active ? 700 : 400,
              background: folder.active
                ? "color-mix(in srgb, var(--uwe-accent) 12%, transparent)"
                : "transparent",
            }}
          >
            <NavIcon
              name={folder.icon}
              width={15}
              height={15}
              style={{ flex: "none", color: folder.active ? "var(--uwe-accent)" : "var(--uwe-fg-subtle)" }}
            />
            <span style={{ flex: 1 }}>{folder.name}</span>
            {folder.count != null ? (
              <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)" }}>{folder.count}</span>
            ) : null}
          </div>
        ))}

        <button
          type="button"
          onClick={onOpenTriage}
          style={{
            margin: "12px 0 4px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 9px",
            borderRadius: 9,
            cursor: "pointer",
            textAlign: "left",
            border: triageActive
              ? "2px solid var(--uwe-accent)"
              : "1px solid color-mix(in srgb, var(--uwe-accent) 32%, var(--uwe-border))",
            background: triageActive
              ? "color-mix(in srgb, var(--uwe-accent) 12%, transparent)"
              : "color-mix(in srgb, var(--uwe-accent) 8%, transparent)",
          }}
        >
          <NavIcon name="sparkles" width={15} height={15} style={{ color: "var(--uwe-accent)", flex: "none" }} />
          <span style={{ flex: 1, fontSize: 13, color: "var(--uwe-fg)", fontWeight: 700 }}>KI-Triage</span>
          {triageCount > 0 ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--uwe-on-accent)",
                background: "var(--uwe-accent)",
                padding: "1px 6px",
                borderRadius: 999,
              }}
            >
              {triageCount}
            </span>
          ) : null}
        </button>

        {categories.length > 0 ? (
          <>
            <EyebrowLabel style={{ padding: "8px 8px 4px" }}>Kategorien</EyebrowLabel>
            {categories.map((category) => {
              const active = activeCategory === category.key;
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => onSelectCategory(active ? null : category.key)}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 8px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    background: active ? "color-mix(in srgb, var(--uwe-accent) 12%, transparent)" : "transparent",
                  }}
                >
                  <Dot color={CATEGORY_COLORS[category.key]} size={9} square />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: active ? "var(--uwe-fg)" : "var(--uwe-fg-muted)",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {category.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)" }}>{category.count}</span>
                </button>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
