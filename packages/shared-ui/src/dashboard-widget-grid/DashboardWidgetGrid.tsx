"use client";

import type { ReactNode } from "react";
import type { DashboardWidgetColumn, DashboardWidgetConfig } from "@uwe/database/dashboard-layout";

const COLUMNS: DashboardWidgetColumn[] = [1, 2, 3];

function widgetsForColumn(widgets: DashboardWidgetConfig[], column: DashboardWidgetColumn) {
  return widgets
    .filter((widget) => widget.column === column && widget.visible)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export interface DashboardWidgetGridProps {
  widgets: DashboardWidgetConfig[];
  renderWidget: (widget: DashboardWidgetConfig) => ReactNode;
}

export function DashboardWidgetGrid({ widgets, renderWidget }: DashboardWidgetGridProps) {
  return (
    // TODO(design-kit): uwe-layout-grid kept — ".portal-dashboard .uwe-layout-grid"
    // (uwe.css) sets a different margin-top when nested under Portal's
    // PortalWorldDashboardClient.tsx (apps/portal, out of scope), and the grid's
    // 1100px/760px column-count breakpoints back the widget.column (1|2|3) contract.
    <div className="uwe-layout-grid">
      {COLUMNS.map((column) => (
        <div
          key={column}
          className="flex min-h-16 flex-col gap-3"
          data-column={column}
        >
          {widgetsForColumn(widgets, column).map((widget) => (
            <article key={widget.id} className="relative" data-widget-type={widget.widgetType}>
              {renderWidget(widget)}
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
