import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface EditableSectionProps {
  regionId: string;
  defaultValue?: Record<string, unknown>;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  as?: React.ElementType;
}

export function EditableSection({
  regionId,
  defaultValue = {},
  label = regionId,
  className = '',
  style = {},
  children,
  as: Component = 'section',
}: EditableSectionProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const [value] = useEditable<Record<string, unknown>>(regionId, defaultValue, 'section', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'section',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'section',
        pageId,
      });
    }
  };

  if (!editMode) {
    return <Component className={className} style={style}>{children}</Component>;
  }

  return (
    <Component
      className={`rcms-editable-region rcms-editable-section ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '4px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="section"
    >
      {children}
    </Component>
  );
}
