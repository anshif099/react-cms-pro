import React, { useContext } from 'react';
import { useEditable } from '../hooks/useEditable';
import { CMSContext } from '../context/CMSContext';
import { PageContext } from '../context/PageContext';
import { MessageBus } from '../messaging/MessageBus';

export interface VideoValue {
  url: string;
  title?: string;
}

export interface EditableVideoProps {
  regionId: string;
  defaultValue: VideoValue | string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function EditableVideo({
  regionId,
  defaultValue,
  label = regionId,
  className = '',
  style = {},
}: EditableVideoProps) {
  const cms = useContext(CMSContext);
  const page = useContext(PageContext);

  const defaultVidObj: VideoValue = typeof defaultValue === 'string'
    ? { url: defaultValue }
    : defaultValue;

  const [value] = useEditable<VideoValue>(regionId, defaultVidObj, 'video', label);
  const editMode = cms?.editMode || false;
  const pageId = page?.currentPage?.id || 'global';

  const videoUrl = typeof value === 'string' ? value : value?.url || '';

  const handleClick = (e: React.MouseEvent) => {
    if (editMode && cms?.websiteId) {
      e.stopPropagation();
      MessageBus.send('rcms/v1/region-selected', cms.websiteId, {
        regionId,
        type: 'video',
        pageId,
        value,
      });
      MessageBus.send('rcms/v1/open-inspector', cms.websiteId, {
        regionId,
        type: 'video',
        pageId,
      });
    }
  };

  const isEmbed = videoUrl.includes('youtube') || videoUrl.includes('vimeo');

  if (!editMode) {
    if (isEmbed) {
      return <iframe src={videoUrl} title={label} className={className} style={style} allowFullScreen />;
    }
    return <video src={videoUrl} controls className={className} style={style} />;
  }

  return (
    <div
      className={`rcms-editable-region rcms-editable-video ${className}`}
      style={{
        ...style,
        outline: '2px dashed #3b82f6',
        outlineOffset: '2px',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      data-rcms-region={regionId}
      data-rcms-type="video"
    >
      {isEmbed ? (
        <iframe src={videoUrl} title={label} className={className} style={{ ...style, pointerEvents: 'none' }} />
      ) : (
        <video src={videoUrl} className={className} style={{ ...style, pointerEvents: 'none' }} />
      )}
    </div>
  );
}
