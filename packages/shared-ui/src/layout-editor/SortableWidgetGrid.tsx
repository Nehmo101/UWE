"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import type { DashboardWidgetColumn, DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import { Button } from "../components/Button";
import { useLayoutEditor } from "./LayoutEditorProvider";

const COLUMNS: DashboardWidgetColumn[] = [1, 2, 3];

function columnContainerId(column: DashboardWidgetColumn): string {
  return `column-${column}`;
}

function parseColumnContainerId(id: string): DashboardWidgetColumn | null {
  if (id === "column-1") return 1;
  if (id === "column-2") return 2;
  if (id === "column-3") return 3;
  return null;
}

function normalizeWidgetOrders(widgets: DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  const byColumn = new Map<DashboardWidgetColumn, DashboardWidgetConfig[]>();
  for (const column of COLUMNS) {
    byColumn.set(column, []);
  }

  for (const widget of widgets) {
    byColumn.get(widget.column)?.push({ ...widget });
  }

  const normalized: DashboardWidgetConfig[] = [];
  for (const column of COLUMNS) {
    const columnWidgets = (byColumn.get(column) ?? []).sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id),
    );
    columnWidgets.forEach((entry, index) => {
      normalized.push({ ...entry, column, order: index });
    });
  }

  return normalized;
}

function widgetsForColumn(widgets: DashboardWidgetConfig[], column: DashboardWidgetColumn) {
  return widgets
    .filter((widget) => widget.column === column)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function reorderWidgets(
  widgets: DashboardWidgetConfig[],
  activeId: string,
  overId: string,
): DashboardWidgetConfig[] {
  const activeWidget = widgets.find((widget) => widget.id === activeId);
  if (!activeWidget) {
    return widgets;
  }

  const overColumn = parseColumnContainerId(overId);
  const overWidget = widgets.find((widget) => widget.id === overId);
  const targetColumn = overColumn ?? overWidget?.column ?? activeWidget.column;

  const sourceColumnWidgets = widgetsForColumn(widgets, activeWidget.column);
  const sourceIds = sourceColumnWidgets.map((widget) => widget.id);

  let nextWidgets = widgets.map((widget) => ({ ...widget }));

  if (targetColumn !== activeWidget.column) {
    nextWidgets = nextWidgets.map((widget) =>
      widget.id === activeId ? { ...widget, column: targetColumn } : widget,
    );
  }

  const updatedTargetWidgets = widgetsForColumn(nextWidgets, targetColumn);
  const updatedTargetIds = updatedTargetWidgets.map((widget) => widget.id);

  const activeIndex =
    targetColumn === activeWidget.column
      ? sourceIds.indexOf(activeId)
      : updatedTargetIds.indexOf(activeId);
  const overIndex = overColumn
    ? updatedTargetIds.length
    : updatedTargetIds.indexOf(overId);

  if (activeIndex < 0 || overIndex < 0) {
    return normalizeWidgetOrders(nextWidgets);
  }

  const reorderedIds = [...updatedTargetIds];
  reorderedIds.splice(activeIndex, 1);
  reorderedIds.splice(overIndex, 0, activeId);

  const orderById = new Map(reorderedIds.map((id, index) => [id, index]));
  nextWidgets = nextWidgets.map((widget) =>
    widget.column === targetColumn
      ? { ...widget, order: orderById.get(widget.id) ?? widget.order }
      : widget,
  );

  return normalizeWidgetOrders(nextWidgets);
}

interface SortableWidgetItemProps {
  widget: DashboardWidgetConfig;
  isEditing: boolean;
  children: ReactNode;
  onToggleVisible: (widgetId: string) => void;
}

function SortableWidgetItem({
  widget,
  isEditing,
  children,
  onToggleVisible,
}: SortableWidgetItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!widget.visible && !isEditing) {
    return null;
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        "uwe-layout-widget",
        isEditing ? "uwe-layout-widget-editing" : "",
        isDragging ? "uwe-layout-widget-dragging" : "",
        !widget.visible ? "uwe-layout-widget-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-widget-type={widget.widgetType}
    >
      {isEditing && (
        <header className="uwe-layout-widget-toolbar">
          <button type="button" className="uwe-layout-drag-handle" aria-label="Widget verschieben" {...attributes} {...listeners}>
            ⋮⋮
          </button>
          <span className="uwe-layout-widget-label">{widget.widgetType}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onToggleVisible(widget.id)}>
            {widget.visible ? "Ausblenden" : "Einblenden"}
          </Button>
        </header>
      )}
      <div className={widget.visible || isEditing ? undefined : "uwe-layout-widget-content-hidden"}>
        {children}
      </div>
    </article>
  );
}

interface LayoutColumnProps {
  column: DashboardWidgetColumn;
  widgets: DashboardWidgetConfig[];
  isEditing: boolean;
  renderWidget: (widget: DashboardWidgetConfig) => ReactNode;
  onToggleVisible: (widgetId: string) => void;
}

function LayoutColumn({ column, widgets, isEditing, renderWidget, onToggleVisible }: LayoutColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnContainerId(column) });
  const columnWidgets = widgetsForColumn(widgets, column);
  const visibleWidgets = isEditing ? columnWidgets : columnWidgets.filter((widget) => widget.visible);

  return (
    <div
      ref={setNodeRef}
      className={["uwe-layout-column", isOver ? "uwe-layout-column-over" : ""].filter(Boolean).join(" ")}
      data-column={column}
    >
      <SortableContext items={columnWidgets.map((widget) => widget.id)} strategy={verticalListSortingStrategy}>
        {visibleWidgets.map((widget) => (
          <SortableWidgetItem
            key={widget.id}
            widget={widget}
            isEditing={isEditing}
            onToggleVisible={onToggleVisible}
          >
            {renderWidget(widget)}
          </SortableWidgetItem>
        ))}
      </SortableContext>
    </div>
  );
}

export interface SortableWidgetGridProps {
  renderWidget: (widget: DashboardWidgetConfig) => ReactNode;
}

export function SortableWidgetGrid({ renderWidget }: SortableWidgetGridProps) {
  const { isEditing, draftWidgets, savedWidgets, setDraftWidgets } = useLayoutEditor();
  const displayWidgets = isEditing ? draftWidgets : savedWidgets;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeWidget = useMemo(
    () => draftWidgets.find((widget) => widget.id === activeId) ?? null,
    [activeId, draftWidgets],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) {
      return;
    }

    setDraftWidgets(reorderWidgets(draftWidgets, String(active.id), String(over.id)));
  };

  const toggleVisible = (widgetId: string) => {
    setDraftWidgets(
      draftWidgets.map((widget) =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget,
      ),
    );
  };

  const grid = (
    <div className="uwe-layout-grid">
      {COLUMNS.map((column) => (
        <LayoutColumn
          key={column}
          column={column}
          widgets={displayWidgets}
          isEditing={isEditing}
          renderWidget={renderWidget}
          onToggleVisible={toggleVisible}
        />
      ))}
    </div>
  );

  if (!isEditing) {
    return grid;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {grid}
      <DragOverlay>
        {activeWidget ? (
          <div className="uwe-layout-widget uwe-layout-widget-drag-overlay">{renderWidget(activeWidget)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
