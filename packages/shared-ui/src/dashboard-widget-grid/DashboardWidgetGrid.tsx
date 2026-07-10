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
    <div className="uwe-layout-grid">
      {COLUMNS.map((column) => (
        <div key={column} className="uwe-layout-column" data-column={column}>
          {widgetsForColumn(widgets, column).map((widget) => (
            <article key={widget.id} className="uwe-layout-widget" data-widget-type={widget.widgetType}>
              {renderWidget(widget)}
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
