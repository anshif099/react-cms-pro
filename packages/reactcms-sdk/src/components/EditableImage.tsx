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
  objectFit?: React.CSSProperties['objectFit'];
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
  const isObj = typeof value === 'object' && value !== null;
  if (isObj) {
    if (value.width) imgStyle.width = value.width;
    if (value.height) imgStyle.height = value.height;
    if (value.objectFit) imgStyle.objectFit = value.objectFit;
  }
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const offX = isDragging ? dragOffset.x : ((isObj ? value.offsetX : 0) || dragOffset.x || 0);
  const offY = isDragging ? dragOffset.y : ((isObj ? value.offsetY : 0) || dragOffset.y || 0);
  if ((offX || offY) && (isDragging || vw >= 1240)) {
    imgStyle.transform = `translate(${offX}px, ${offY}px)`;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;

    if (cms?.websiteId) {
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
        value,
        additive: e.metaKey || e.ctrlKey || e.shiftKey,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
      });
    }

    const initX = (isObj ? value.offsetX : 0) || 0;
    const initY = (isObj ? value.offsetY : 0) || 0;

    dragStartRef.current = { startX: touch.clientX, startY: touch.clientY, initX, initY };

    const handleTouchMove = (moveEv: TouchEvent) => {
      if (!dragStartRef.current || !moveEv.touches[0]) return;
      const t = moveEv.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setIsDragging(true);
        setDragOffset({ x: dragStartRef.current.initX + dx, y: dragStartRef.current.initY + dy });
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
            const baseObj = isObj ? { ...value } : { src: imgSrc, alt: imgAlt };
            baseObj.offsetX = finalX;
            baseObj.offsetY = finalY;
            setDragOffset({ x: finalX, y: finalY });
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

    if (cms?.websiteId) {
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
        value,
        additive: e.metaKey || e.ctrlKey || e.shiftKey,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'image',
        pageId,
      });
    }

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
          const baseObj = isObj ? { ...value } : { src: imgSrc, alt: imgAlt };
          baseObj.offsetX = finalX;
          baseObj.offsetY = finalY;
          setDragOffset({ x: finalX, y: finalY });
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
      onTouchStart={handleTouchStart}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      data-rcms-region={regionId}
      data-rcms-type="image"
      data-rcms-label={label}
    />
  );
}
