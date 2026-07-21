import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface ButtonValue {
  text: string;
  href?: string;
  variant?: string;
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
      <Tag {...tagProps} className={className} style={style} onClick={onClick}>
        {btnText}
      </Tag>
    );
  }

  return (
    <Tag
      {...tagProps}
      className={`rcms-editable-region rcms-editable-button ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="button"
    >
      {btnText}
    </Tag>
  );
}
