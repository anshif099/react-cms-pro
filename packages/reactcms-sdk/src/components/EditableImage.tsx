import React, { useContext, useState, useRef } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface ImageValue {
  src: string;
  alt?: string;
  width?: string;
  height?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface EditableImageProps {
  regionId: string;
  defaultValue: ImageValue | string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function EditableImage({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
  alt,
}: EditableImageProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const defaultImgObj: ImageValue = typeof defaultValue === 'string'
    ? { src: defaultValue, alt: alt || '' }
    : defaultValue;

  const [value, setValue] = useEditable<ImageValue>(regionId, defaultImgObj, 'image', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const imgSrc = typeof value === 'string' ? value : value?.src || '';
  const imgAlt = typeof value === 'string' ? (alt || '') : (value?.alt || alt || '');

  const imgStyle: React.CSSProperties = { ...style };
  if (typeof value === 'object' && value !== null) {
    if (value.width) imgStyle.width = value.width;
    if (value.height) imgStyle.height = value.height;
    const offX = isDragging ? dragOffset.x : (value.offsetX || 0);
    const offY = isDragging ? dragOffset.y : (value.offsetY || 0);
    if (offX || offY) {
      imgStyle.transform = `translate(${offX}px, ${offY}px)`;
    }
  } else if (isDragging && (dragOffset.x || dragOffset.y)) {
    imgStyle.transform = `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();

    if (cms?.websiteId) {
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
      });
    }

    const isObj = typeof value === 'object' && value !== null;
    const initX = (isObj ? value.offsetX : 0) || 0;
    const initY = (isObj ? value.offsetY : 0) || 0;

    dragStartRef.current = { startX: e.clientX, startY: e.clientY, initX, initY };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEv.clientX - dragStartRef.current.startX;
      const dy = moveEv.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setIsDragging(true);
        setDragOffset({ x: dragStartRef.current.initX + dx, y: dragStartRef.current.initY + dy });
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
          const baseObj = typeof value === 'object' ? { ...value } : { src: imgSrc, alt: imgAlt };
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
    return <img src={imgSrc} alt={imgAlt} className={className} style={imgStyle} />;
  }

  return (
    <img
      src={imgSrc}
      alt={imgAlt}
      className={`rcms-editable-region rcms-editable-image ${className}`}
      style={{
        ...imgStyle,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      data-rcms-region={regionId}
      data-rcms-type="image"
    />
  );
}

