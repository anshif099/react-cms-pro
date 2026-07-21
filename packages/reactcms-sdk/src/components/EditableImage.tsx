import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface ImageValue {
  src: string;
  alt?: string;
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

  const [value] = useEditable<ImageValue>(regionId, defaultImgObj, 'image', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const imgSrc = typeof value === 'string' ? value : value?.src || '';
  const imgAlt = typeof value === 'string' ? (alt || '') : (value?.alt || alt || '');

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
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
  };

  if (!editMode) {
    return <img src={imgSrc} alt={imgAlt} className={className} style={style} />;
  }

  return (
    <img
      src={imgSrc}
      alt={imgAlt}
      className={`rcms-editable-region rcms-editable-image ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="image"
    />
  );
}
