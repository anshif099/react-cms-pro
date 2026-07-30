import React, { useContext } from 'react';
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
}

export interface EditableButtonProps {
  regionId: string;
  defaultValue: ButtonValue | string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  as?: React.ElementType;
}

export function EditableButton({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
  onClick,
  as: Component = 'button',
}: EditableButtonProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const defaultBtnObj: ButtonValue = typeof defaultValue === 'string'
    ? { text: defaultValue }
    : defaultValue;

  const [value] = useEditable<ButtonValue>(regionId, defaultBtnObj, 'button', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const btnText = typeof value === 'string' ? value : value?.text || '';
  const btnHref = typeof value === 'object' ? value?.href : undefined;
  const buttonStyle: React.CSSProperties = { ...style };
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

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.preventDefault();
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'button',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'button',
        pageId,
      });
    } else if (onClick) {
      onClick(e);
    }
  };

  const Tag = btnHref && !editMode ? 'a' : Component;
  const tagProps = Tag === 'a' ? { href: btnHref } : {};

  if (!editMode) {
    return (
      <Tag {...tagProps} className={className} style={buttonStyle} onClick={onClick}>
        {btnText}
      </Tag>
    );
  }

  return (
    <Tag
      {...tagProps}
      className={`rcms-editable-region rcms-editable-button ${className}`}
      style={{
        ...buttonStyle,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="button"
      data-rcms-label={label}
    >
      {btnText}
    </Tag>
  );
}
