import React, { useContext, useState, useRef } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';
import { getElementComputedStyle } from '../utils/domStyles';

export interface EditableTextProps {
  regionId: string;
  defaultValue: any;
  label?: string;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
}

export function EditableText({
  regionId,
  defaultValue,
  label = regionId,
  as: Component = 'span',
  className = '',
  style = {},
}: EditableTextProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);
  const [value, setValue] = useEditable<any>(regionId, defaultValue, 'text', label);

  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Resizing state for corner handle
  const [isResizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isRich = typeof value === 'object' && value !== null;
  const displayValue = isRich ? (value.text !== undefined ? value.text : '') : value;
  
  const textStyle: React.CSSProperties = {};
  if (isRich) {
    if (value.fontSize) textStyle.fontSize = value.fontSize;
    if (value.fontWeight) textStyle.fontWeight = value.fontWeight;
    if (value.color) textStyle.color = value.color;
    if (value.width) textStyle.width = value.width;
    if (value.maxWidth) textStyle.maxWidth = value.maxWidth;

    // Responsive alignment: pick breakpoint-specific value based on viewport width
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    let resolvedAlign: string | undefined;
    if (vw < 768 && value.alignMobile) {
      resolvedAlign = value.alignMobile;
    } else if (vw < 1024 && value.alignTablet) {
      resolvedAlign = value.alignTablet;
    } else if (value.align) {
      resolvedAlign = value.align;
    }
    if (resolvedAlign) textStyle.textAlign = resolvedAlign as React.CSSProperties['textAlign'];

    const offX = isDragging ? dragOffset.x : (value.offsetX || 0);
    const offY = isDragging ? dragOffset.y : (value.offsetY || 0);
    if (offX || offY) {
      textStyle.transform = `translate(${offX}px, ${offY}px)`;
    }
  } else if (isDragging && (dragOffset.x || dragOffset.y)) {
    textStyle.transform = `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
  }

  if (resizeWidth) {
    textStyle.width = `${resizeWidth}px`;
    textStyle.maxWidth = '100%';
    textStyle.display = 'inline-block';
  }

  const handleUpdateAlign = (newAlign: string) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    let alignKey = 'align';
    if (vw < 768) alignKey = 'alignMobile';
    else if (vw < 1024) alignKey = 'alignTablet';

    const baseObj = isRich ? { ...value } : { text: displayValue };
    baseObj[alignKey] = newAlign;
    setValue(baseObj);
  };

  const handleResetPosition = () => {
    const baseObj = isRich ? { ...value } : { text: displayValue };
    delete baseObj.offsetX;
    delete baseObj.offsetY;
    delete baseObj.width;
    setDragOffset({ x: 0, y: 0 });
    setResizeWidth(null);
    setValue(baseObj);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);

    const targetEl = e.currentTarget.parentElement as HTMLElement;
    const startWidth = targetEl ? targetEl.getBoundingClientRect().width : 300;

    resizeStartRef.current = {
      startX: e.clientX,
      startWidth,
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dx = moveEv.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(120, Math.round(resizeStartRef.current.startWidth + dx));
      setResizeWidth(newWidth);
    };

    const handleMouseUp = (upEv: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (resizeStartRef.current) {
        const dx = upEv.clientX - resizeStartRef.current.startX;
        const finalWidth = Math.max(120, Math.round(resizeStartRef.current.startWidth + dx));
        const baseObj = isRich ? { ...value } : { text: displayValue };
        baseObj.width = `${finalWidth}px`;
        setValue(baseObj);
      }

      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchResizeStart = (e: React.TouchEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    setIsResizing(true);

    const targetEl = e.currentTarget.parentElement as HTMLElement;
    const startWidth = targetEl ? targetEl.getBoundingClientRect().width : 300;

    resizeStartRef.current = {
      startX: touch.clientX,
      startWidth,
    };

    const handleTouchMove = (moveEv: TouchEvent) => {
      if (!resizeStartRef.current || !moveEv.touches[0]) return;
      const t = moveEv.touches[0];
      const dx = t.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(120, Math.round(resizeStartRef.current.startWidth + dx));
      setResizeWidth(newWidth);
    };

    const handleTouchEnd = (endEv: TouchEvent) => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      if (resizeStartRef.current) {
        const lastTouch = endEv.changedTouches[0];
        if (lastTouch) {
          const dx = lastTouch.clientX - resizeStartRef.current.startX;
          const finalWidth = Math.max(120, Math.round(resizeStartRef.current.startWidth + dx));
          const baseObj = isRich ? { ...value } : { text: displayValue };
          baseObj.width = `${finalWidth}px`;
          setValue(baseObj);
        }
      }

      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    setIsSelected(true);

    const touch = e.touches[0];
    if (!touch) return;

    if (cms?.websiteId) {
      const computedStyle = getElementComputedStyle(e.currentTarget as HTMLElement);
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
        value,
        computedStyle,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
      });
    }

    const initX = (isRich ? value.offsetX : 0) || 0;
    const initY = (isRich ? value.offsetY : 0) || 0;

    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initX,
      initY,
    };

    const handleTouchMove = (moveEv: TouchEvent) => {
      if (!dragStartRef.current || !moveEv.touches[0]) return;
      const t = moveEv.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setIsDragging(true);
        setDragOffset({
          x: dragStartRef.current.initX + dx,
          y: dragStartRef.current.initY + dy,
        });
      }
    };

    const handleTouchEnd = (endEv: TouchEvent) => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      if (dragStartRef.current) {
        const lastTouch = endEv.changedTouches[0];
        if (lastTouch) {
          const dx = lastTouch.clientX - dragStartRef.current.startX;
          const dy = lastTouch.clientY - dragStartRef.current.startY;

          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            const finalX = dragStartRef.current.initX + dx;
            const finalY = dragStartRef.current.initY + dy;

            const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
            let alignKey = 'align';
            if (vw < 768) alignKey = 'alignMobile';
            else if (vw < 1024) alignKey = 'alignTablet';

            let newAlign = (isRich ? value[alignKey] : undefined) || 'left';
            if (dx < -40) newAlign = 'left';
            else if (dx > 40) newAlign = 'right';

            const baseObj = isRich ? { ...value } : { text: displayValue };
            baseObj[alignKey] = newAlign;
            baseObj.offsetX = finalX;
            baseObj.offsetY = finalY;

            setValue(baseObj);
          }
        }
      }

      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    setIsSelected(true);

    if (cms?.websiteId) {
      const computedStyle = getElementComputedStyle(e.currentTarget as HTMLElement);
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
        value,
        computedStyle,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
      });
    }

    const initX = (isRich ? value.offsetX : 0) || 0;
    const initY = (isRich ? value.offsetY : 0) || 0;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX,
      initY,
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEv.clientX - dragStartRef.current.startX;
      const dy = moveEv.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setIsDragging(true);
        setDragOffset({
          x: dragStartRef.current.initX + dx,
          y: dragStartRef.current.initY + dy,
        });
      }
    };

    const handleMouseUp = (upEv: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (dragStartRef.current) {
        const dx = upEv.clientX - dragStartRef.current.startX;
        const dy = upEv.clientY - dragStartRef.current.startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          const finalX = dragStartRef.current.initX + dx;
          const finalY = dragStartRef.current.initY + dy;

          const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
          let alignKey = 'align';
          if (vw < 768) alignKey = 'alignMobile';
          else if (vw < 1024) alignKey = 'alignTablet';

          let newAlign = (isRich ? value[alignKey] : undefined) || 'left';
          if (dx < -40) newAlign = 'left';
          else if (dx > 40) newAlign = 'right';

          const baseObj = isRich ? { ...value } : { text: displayValue };
          baseObj[alignKey] = newAlign;
          baseObj.offsetX = finalX;
          baseObj.offsetY = finalY;

          setValue(baseObj);
        }
      }

      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!editMode) {
    return (
      <Component className={className} style={{ ...style, ...textStyle }}>
        {displayValue}
      </Component>
    );
  }

  const activeAlign = textStyle.textAlign || 'left';

  return (
    <Component
      className={`rcms-editable-region rcms-editable-text ${className}`}
      style={{
        ...style,
        ...textStyle,
        outline: isSelected ? '2px solid #3b82f6' : '2px dashed #3b82f6',
        outlineOffset: '2px',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      data-rcms-region={regionId}
      data-rcms-type="text"
    >
      {displayValue}

      {/* Floating Alignment Quick Toolbar */}
      {isSelected && (
        <span
          style={{
            position: 'absolute',
            top: '-42px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '4px 8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
            fontFamily: 'sans-serif',
            fontSize: '11px',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, paddingRight: '4px', borderRight: '1px solid #334155' }}>
            {typeof window !== 'undefined' && window.innerWidth < 768 ? '📱 Mobile' : typeof window !== 'undefined' && window.innerWidth < 1024 ? '💻 Tablet' : '🖥️ Desktop'}
          </span>
          <button
            type="button"
            title="Align Left"
            onClick={() => handleUpdateAlign('left')}
            style={{
              background: activeAlign === 'left' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ⬅️ Left
          </button>
          <button
            type="button"
            title="Align Center"
            onClick={() => handleUpdateAlign('center')}
            style={{
              background: activeAlign === 'center' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ↔️ Center
          </button>
          <button
            type="button"
            title="Align Right"
            onClick={() => handleUpdateAlign('right')}
            style={{
              background: activeAlign === 'right' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ➡️ Right
          </button>
          {(isRich && (value.offsetX || value.offsetY)) ? (
            <button
              type="button"
              title="Reset Position Offset"
              onClick={handleResetPosition}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ↺ Reset Pos
            </button>
          ) : null}
          <button
            type="button"
            title="Close"
            onClick={() => setIsSelected(false)}
            style={{
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              padding: '0 4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </span>
      )}

      {/* Bottom-Right Corner Handle to resize text area width */}
      {editMode && (
        <span
          title="Drag handle to resize text area width"
          style={{
            position: 'absolute',
            bottom: '-6px',
            right: '-6px',
            width: '12px',
            height: '12px',
            background: isResizing ? '#2563eb' : '#3b82f6',
            border: '2px solid #ffffff',
            borderRadius: '3px',
            cursor: 'se-resize',
            zIndex: 99999,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
          }}
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleTouchResizeStart}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        />
      )}
    </Component>
  );
}

