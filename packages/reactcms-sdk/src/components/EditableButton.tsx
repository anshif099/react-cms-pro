import React, { useContext, useEffect, useState } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface ButtonValue {
  text: string;
  href?: string;
  variant?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  radius?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  width?: string;
  height?: string;
  icon?: string;
  iconImage?: string;
  iconPosition?: 'left' | 'right';
  iconSize?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface EditableButtonProps {
  regionId: string;
  defaultValue: ButtonValue | string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  as?: React.ElementType;
  children?: React.ReactNode | ((value: ButtonValue | string) => React.ReactNode);
}

export function EditableButton({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
  onClick,
  as: Component = 'button',
  children,
}: EditableButtonProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const defaultBtnObj: ButtonValue = typeof defaultValue === 'string'
    ? { text: defaultValue }
    : defaultValue;

  const [value, setValue] = useEditable<ButtonValue>(regionId, defaultBtnObj, 'button', label);
  const [resizePreview, setResizePreview] = useState<{ width: number; height: number } | null>(null);
  const [positionPreview, setPositionPreview] = useState<{ offsetX: number; offsetY: number } | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const btnText = typeof value === 'string' ? value : value?.text || '';
  const btnHref = typeof value === 'object' ? value?.href : undefined;
  const offsetX = typeof value === 'object' ? Number(value?.offsetX) || 0 : 0;
  const offsetY = typeof value === 'object' ? Number(value?.offsetY) || 0 : 0;
  const displayedOffsetX = positionPreview?.offsetX ?? offsetX;
  const displayedOffsetY = positionPreview?.offsetY ?? offsetY;
  const buttonStyle: React.CSSProperties = { ...style };
  buttonStyle.display = 'inline-flex';
  buttonStyle.alignItems = 'center';
  buttonStyle.justifyContent = 'center';
  buttonStyle.gap = '8px';
  buttonStyle.boxSizing = 'border-box';
  if (displayedOffsetX) buttonStyle.marginLeft = `${displayedOffsetX}px`;
  if (displayedOffsetY) buttonStyle.marginTop = `${displayedOffsetY}px`;
  if (typeof value === 'object' && value) {
    if (value.color) {
      if (value.variant === 'outline' || value.variant === 'ghost') {
        buttonStyle.backgroundColor = 'transparent';
        buttonStyle.color = value.color;
        buttonStyle.border = value.variant === 'outline' ? `1px solid ${value.color}` : '1px solid transparent';
      } else {
        buttonStyle.backgroundColor = value.color;
        buttonStyle.color = '#ffffff';
      }
    }
    if (value.radius !== undefined) buttonStyle.borderRadius = `${value.radius}px`;
    if (value.width) buttonStyle.width = value.width;
    if (value.height) buttonStyle.height = value.height;
    if (value.size) {
      buttonStyle.padding = value.size === 'lg'
        ? '14px 24px'
        : value.size === 'sm'
          ? '8px 14px'
          : '11px 20px';
    }
    if (value.shadow) {
      buttonStyle.boxShadow = value.shadow === 'none'
        ? 'none'
        : value.shadow === 'lg'
          ? '0 20px 40px rgba(15,23,42,.2)'
          : value.shadow === 'sm'
            ? '0 4px 10px rgba(15,23,42,.1)'
            : '0 10px 25px rgba(15,23,42,.15)';
    }
  }
  if (resizePreview) {
    buttonStyle.width = `${resizePreview.width}px`;
    buttonStyle.height = `${resizePreview.height}px`;
  }

  useEffect(() => MessageBus.subscribe((message) => {
    if (message.type !== 'rcms/v1/region-selected') return;
    const payload = message.payload as { regionId?: string; type?: string };
    setIsSelected(payload.regionId === regionId && payload.type === 'button');
  }), [regionId]);

  const selectButton = (additive = false) => {
    if (!editMode || !cms?.websiteId) return;
    setIsSelected(true);
    MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
      regionId,
      type: 'button',
      pageId,
      value,
      additive,
    });
    MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
      regionId,
      type: 'button',
      pageId,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.preventDefault();
      e.stopPropagation();
      selectButton(e.metaKey || e.ctrlKey || e.shiftKey);
    } else if (onClick) {
      onClick(e);
    }
  };

  const Tag = btnHref && !editMode ? 'a' : Component;
  const tagProps = Tag === 'a' ? { href: btnHref } : {};

  const providedContent = typeof children === 'function'
    ? children(value || defaultBtnObj)
    : (children !== undefined ? children : btnText);
  const iconSize = typeof value === 'object' ? value?.iconSize || 18 : 18;
  const customIcon = typeof value === 'object' && value?.iconImage ? (
    <img src={value.iconImage} alt="" aria-hidden="true" style={{ width: iconSize, height: iconSize, objectFit: 'contain', flex: '0 0 auto' }} />
  ) : null;
  const symbol = typeof value === 'object' ? ({
    'arrow-right': '→', whatsapp: 'WA', phone: '☎', mail: '✉',
    'external-link': '↗', download: '↓',
  } as Record<string, string>)[value?.icon || ''] : '';
  const presetIcon = !customIcon && symbol ? <span aria-hidden="true">{symbol}</span> : null;
  const buttonIcon = customIcon || presetIcon;
  const renderedContent = children !== undefined ? providedContent : (
    <>
      {typeof value === 'object' && value?.iconPosition !== 'right' ? buttonIcon : null}
      {providedContent}
      {typeof value === 'object' && value?.iconPosition === 'right' ? buttonIcon : null}
    </>
  );

  if (!editMode) {
    return (
      <Tag {...tagProps} className={className} style={buttonStyle} onClick={onClick}>
        {renderedContent}
      </Tag>
    );
  }

  return (
    <Tag
      {...tagProps}
      className={`rcms-editable-region rcms-editable-button ${className}`}
      style={{
        ...buttonStyle,
        outline: isSelected ? '2px solid #2563eb' : '1px dashed rgba(37,99,235,.7)',
        outlineOffset: '2px',
        position: 'relative',
        cursor: 'grab',
      }}
      onPointerDown={(event: React.PointerEvent) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-rcms-resize-handle]')) return;
        event.preventDefault();
        event.stopPropagation();
        selectButton(event.metaKey || event.ctrlKey || event.shiftKey);
        const element = event.currentTarget as HTMLElement;
        const parent = element.parentElement;
        const renderedWidth = element.getBoundingClientRect().width;
        const layoutWidth = element.offsetWidth || renderedWidth;
        const scale = renderedWidth > 0 && layoutWidth > 0 ? renderedWidth / layoutWidth : 1;
        const maxOffsetX = Math.max(0, (parent?.clientWidth || layoutWidth) - layoutWidth);
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        const resolvePosition = (clientX: number, clientY: number) => ({
          offsetX: Math.round(Math.max(0, Math.min(maxOffsetX, offsetX + (clientX - startX) / scale))),
          offsetY: Math.round(Math.max(0, offsetY + (clientY - startY) / scale)),
        });
        const move = (moveEvent: PointerEvent) => {
          if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 2) return;
          moved = true;
          setPositionPreview(resolvePosition(moveEvent.clientX, moveEvent.clientY));
        };
        const cleanup = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', cancel);
        };
        const finish = (upEvent: PointerEvent) => {
          cleanup();
          if (moved) {
            const nextPosition = resolvePosition(upEvent.clientX, upEvent.clientY);
            const next: ButtonValue = typeof value === 'object' && value ? { ...value } : { text: btnText };
            next.offsetX = nextPosition.offsetX;
            next.offsetY = nextPosition.offsetY;
            setValue(next);
          }
          setPositionPreview(null);
        };
        const cancel = () => {
          cleanup();
          setPositionPreview(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', cancel);
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="button"
      data-rcms-label={label}
    >
      {renderedContent}
      <span
        data-rcms-resize-handle="true"
        title="Drag to resize button"
        aria-label="Resize button"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const target = event.currentTarget.parentElement;
          if (!target) return;
          const rect = target.getBoundingClientRect();
          const startX = event.clientX;
          const startY = event.clientY;
          const move = (moveEvent: MouseEvent) => setResizePreview({
            width: Math.max(60, rect.width + moveEvent.clientX - startX),
            height: Math.max(28, rect.height + moveEvent.clientY - startY),
          });
          const up = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            const next = typeof value === 'object' && value ? { ...value } : { text: btnText };
            next.width = `${Math.round(Math.max(60, rect.width + upEvent.clientX - startX))}px`;
            next.height = `${Math.round(Math.max(28, rect.height + upEvent.clientY - startY))}px`;
            setResizePreview(null);
            setValue(next);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        style={{
          position: 'absolute', right: '-7px', bottom: '-7px', width: '13px', height: '13px',
          border: '2px solid #fff', borderRadius: '3px', background: '#2563eb',
          boxShadow: '0 2px 8px rgba(15,23,42,.35)', cursor: 'nwse-resize', zIndex: 2,
        }}
      />
    </Tag>
  );
}
