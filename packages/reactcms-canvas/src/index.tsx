import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  RuntimeRenderer,
} from '@anshif.rainhopes/reactcms-renderer';
import type {
  DropPosition,
  RendererMutation,
  ResponsiveMode,
  RuntimeRendererProps,
} from '@anshif.rainhopes/reactcms-renderer';

export const CANVAS_DEVICE_WIDTHS: Record<ResponsiveMode, number> = {
  desktop: 1440,
  laptop: 1180,
  tablet: 820,
  mobile: 390,
  custom: 960,
};

export interface NativeCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  resetPan(): void;
}

export interface NativeCanvasProps {
  tree: RuntimeRendererProps['tree'];
  locale?: string;
  mode?: RuntimeRendererProps['mode'];
  responsiveMode?: ResponsiveMode;
  customWidth?: number;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  selectedIds?: string[];
  hoveredId?: string | null;
  registry?: RuntimeRendererProps['registry'];
  theme?: RuntimeRendererProps['theme'];
  onSelect?: RuntimeRendererProps['onSelect'];
  onSelectMany?: (nodeIds: string[], additive?: boolean) => void;
  onHover?: RuntimeRendererProps['onHover'];
  onMutation?: (mutation: RendererMutation) => void;
  onMove?: RuntimeRendererProps['onMove'];
  onInsert?: (componentType: string, targetId: string | null, position: DropPosition) => void;
  onCommand?: RuntimeRendererProps['onCommand'];
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

function intersects(a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export const NativeCanvas = forwardRef<NativeCanvasHandle, NativeCanvasProps>(function NativeCanvas({
  tree,
  locale,
  mode = 'edit',
  responsiveMode = 'desktop',
  customWidth = 960,
  zoom: controlledZoom,
  onZoomChange,
  selectedIds = [],
  hoveredId,
  registry,
  theme,
  onSelect,
  onSelectMany,
  onHover,
  onMutation,
  onMove,
  onInsert,
  onCommand,
  className,
}, forwardedRef) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [internalZoom, setInternalZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const zoom = controlledZoom ?? internalZoom;
  const width = responsiveMode === 'custom'
    ? Math.max(280, customWidth)
    : CANVAS_DEVICE_WIDTHS[responsiveMode];

  const setZoom = (next: number) => {
    const clamped = Math.max(.25, Math.min(2, Number(next.toFixed(2))));
    if (controlledZoom === undefined) setInternalZoom(clamped);
    onZoomChange?.(clamped);
  };

  useImperativeHandle(forwardedRef, () => ({
    zoomIn: () => setZoom(zoom + .1),
    zoomOut: () => setZoom(zoom - .1),
    fit: () => {
      const available = viewportRef.current?.clientWidth || width;
      setZoom(Math.min(1, Math.max(.25, (available - 64) / width)));
      setPan({ x: 0, y: 0 });
    },
    resetPan: () => setPan({ x: 0, y: 0 }),
  }), [width, zoom]);

  const viewportPoint = (event: React.PointerEvent): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left || 0),
      y: event.clientY - (rect?.top || 0),
    };
  };

  const finishBoxSelection = (event: React.PointerEvent) => {
    if (!selectionStart || !selectionEnd || !pageRef.current) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) return;
    const box = {
      left: viewportRect.left + Math.min(selectionStart.x, selectionEnd.x),
      top: viewportRect.top + Math.min(selectionStart.y, selectionEnd.y),
      right: viewportRect.left + Math.max(selectionStart.x, selectionEnd.x),
      bottom: viewportRect.top + Math.max(selectionStart.y, selectionEnd.y),
    };
    const ids = Array.from(pageRef.current.querySelectorAll<HTMLElement>('[data-rcms-node]'))
      .filter((element) => intersects(element.getBoundingClientRect(), box))
      .map((element) => element.dataset.rcmsNode)
      .filter((id): id is string => !!id);
    if (ids.length) onSelectMany?.(ids, event.metaKey || event.ctrlKey || event.shiftKey);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const selectionBox = selectionStart && selectionEnd ? {
    left: Math.min(selectionStart.x, selectionEnd.x),
    top: Math.min(selectionStart.y, selectionEnd.y),
    width: Math.abs(selectionEnd.x - selectionStart.x),
    height: Math.abs(selectionEnd.y - selectionStart.y),
  } : null;

  return (
    <div
      ref={viewportRef}
      className={className}
      data-rcms-native-canvas="true"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        background: 'radial-gradient(circle at center,rgba(51,65,85,.34),rgba(7,11,20,.12) 58%)',
        cursor: panning ? 'grabbing' : undefined,
        userSelect: panning || selectionStart ? 'none' : undefined,
      }}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY > 0 ? -.08 : .08));
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        const isBackground = target === viewportRef.current || target.dataset.rcmsCanvasSurface === 'true';
        if (event.button === 1 || event.altKey) {
          event.preventDefault();
          setPanning(true);
          setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
        if (mode === 'edit' && isBackground && event.button === 0) {
          const point = viewportPoint(event);
          setSelectionStart(point);
          setSelectionEnd(point);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        if (panning && panStart) {
          setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
        }
        if (selectionStart) setSelectionEnd(viewportPoint(event));
      }}
      onPointerUp={(event) => {
        if (panning) {
          setPanning(false);
          setPanStart(null);
        }
        if (selectionStart) finishBoxSelection(event);
      }}
      onDragEnter={(event) => {
        if (mode !== 'edit') return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        if (mode === 'edit') event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false);
      }}
      onDrop={(event) => {
        if (mode !== 'edit') return;
        event.preventDefault();
        setDragActive(false);
        const type = event.dataTransfer.getData('application/reactcms-component');
        if (type) onInsert?.(type, null, 'after');
      }}
    >
      <div
        data-rcms-canvas-surface="true"
        style={{
          position: 'relative',
          minWidth: '100%',
          minHeight: '100%',
          padding: '32px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {dragActive && (
          <>
            <div style={{ position: 'fixed', zIndex: 1500, left: '50%', top: 64, bottom: 0, width: 1, background: 'rgba(56,189,248,.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', zIndex: 1500, top: '50%', left: 0, right: 0, height: 1, background: 'rgba(56,189,248,.4)', pointerEvents: 'none' }} />
          </>
        )}

        <div
          ref={pageRef}
          style={{
            position: 'relative',
            flex: '0 0 auto',
            width: `${width}px`,
            minHeight: 'calc(100vh - 180px)',
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
            background: '#fff',
            borderRadius: responsiveMode === 'mobile' ? '24px' : '10px',
            border: responsiveMode === 'mobile' ? '8px solid #111827' : '1px solid #334155',
            boxShadow: '0 28px 80px rgba(0,0,0,.46)',
            overflow: 'visible',
            transition: panning ? 'none' : 'width 220ms ease',
          }}
        >
          <RuntimeRenderer
            tree={tree}
            locale={locale}
            responsiveMode={responsiveMode}
            mode={mode}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            registry={registry}
            theme={theme}
            onSelect={onSelect}
            onHover={onHover}
            onMutation={onMutation}
            onMove={onMove}
            onInsert={(type, targetId, position) => onInsert?.(type, targetId, position)}
            onCommand={onCommand}
          />

          {tree.children.length === 0 && mode === 'edit' && (
            <div style={{
              minHeight: '520px',
              display: 'grid',
              placeItems: 'center',
              border: '2px dashed #cbd5e1',
              margin: '32px',
              borderRadius: '18px',
              color: '#64748b',
              font: '600 14px Inter,system-ui,sans-serif',
            }}>
              Drag an element here or choose Add Element
            </div>
          )}
          {tree.children.length === 0 && mode !== 'edit' && (
            <div style={{
              minHeight: '520px',
              display: 'grid',
              placeItems: 'center',
              padding: '32px',
              color: '#64748b',
              textAlign: 'center',
              font: '600 14px Inter,system-ui,sans-serif',
            }}>
              This page has no published or draft components yet.
            </div>
          )}
        </div>
      </div>

      {selectionBox && (
        <div style={{
          position: 'absolute',
          zIndex: 2000,
          pointerEvents: 'none',
          ...selectionBox,
          border: '1px solid #2563eb',
          background: 'rgba(37,99,235,.1)',
        }} />
      )}

      <div style={{
        position: 'sticky',
        zIndex: 2100,
        left: '50%',
        bottom: '14px',
        width: 'fit-content',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 8px',
        border: '1px solid #334155',
        borderRadius: '10px',
        background: 'rgba(15,23,42,.94)',
        boxShadow: '0 10px 30px rgba(0,0,0,.3)',
        color: '#cbd5e1',
        font: '700 10px Inter,system-ui,sans-serif',
      }}>
        <button type="button" onClick={() => setZoom(zoom - .1)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>−</button>
        <span style={{ minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(zoom + .1)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>+</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', font: 'inherit' }}>Reset</button>
      </div>
    </div>
  );
});

export default NativeCanvas;
