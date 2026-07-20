// Export components/providers
export { CMSProvider } from './providers/CMSProvider';
export { CMSThemeProvider } from './providers/CMSThemeProvider';
export { CMSSEOProvider } from './providers/CMSSEOProvider';

// Export hooks
export { useCMS } from './hooks/useCMS';
export { usePage } from './hooks/usePage';
export { useTheme } from './hooks/useTheme';
export { useSEO } from './hooks/useSEO';
export { useNavigation } from './hooks/useNavigation';
export { useEditable } from './hooks/useEditable';
export { usePlugins } from './hooks/usePlugins';

// Export contexts
export { CMSContext } from './context/CMSContext';
export { PageContext } from './context/PageContext';
export { ThemeContext } from './context/ThemeContext';
export { NavigationContext } from './context/NavigationContext';
export { SEOContext } from './context/SEOContext';
export { EditableRegistryContext } from './context/EditableRegistryContext';

// Export messaging
export { MessageBus } from './messaging/MessageBus';
export { postMessageBridge } from './messaging/postMessageBridge';

// Export firebase
export { getFirebaseApp, getFirebaseDatabase } from './firebase/firebaseClient';


