import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

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
  const [value] = useEditable<any>(regionId, defaultValue, 'text', label);

  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const isRich = typeof value === 'object' && value !== null;
  const displayValue = isRich ? value.text : value;
  const textStyle: React.CSSProperties = isRich
    ? {
        fontSize: value.fontSize,
        fontWeight: value.fontWeight,
        color: value.color,
        textAlign: value.align,
      }
    : {};

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'text',
        pageId,
      });
    }
  };

  if (!editMode) {
    return (
      <Component className={className} style={{ ...style, ...textStyle }}>
        {displayValue}
      </Component>
    );
  }

  return (
    <Component
      className={`rcms-editable-region rcms-editable-text ${className}`}
      style={{
        ...style,
        ...textStyle,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="text"
    >
      {displayValue}
    </Component>
  );
}
