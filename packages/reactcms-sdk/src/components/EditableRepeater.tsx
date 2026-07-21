import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface EditableRepeaterProps<T> {
  regionId: string;
  defaultValue: T[];
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children: (items: T[]) => React.ReactNode;
}

export function EditableRepeater<T = unknown>({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
  children,
}: EditableRepeaterProps<T>) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const [value] = useEditable<T[]>(regionId, defaultValue, 'repeater', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const items = Array.isArray(value) ? value : defaultValue;

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'repeater',
        pageId,
        value: items,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'repeater',
        pageId,
      });
    }
  };

  if (!editMode) {
    return <div className={className} style={style}>{children(items)}</div>;
  }

  return (
    <div
      className={`rcms-editable-region rcms-editable-repeater ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="repeater"
    >
      {children(items)}
    </div>
  );
}
