import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface EditableRichTextProps {
  regionId: string;
  defaultValue: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

export function EditableRichText({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
  as: Component = 'div',
}: EditableRichTextProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const [value] = useEditable<string>(regionId, defaultValue, 'richtext', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'richtext',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'richtext',
        pageId,
      });
    }
  };

  if (!editMode) {
    return (
      <Component
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <Component
      className={`rcms-editable-region rcms-editable-richtext ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: value }}
      data-rcms-region={regionId}
      data-rcms-type="richtext"
    />
  );
}
