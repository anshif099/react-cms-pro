export interface ThemeTokens {
  branding: {
    siteName: string;
    logo: string;
    tagline: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    darkBackground: string;
    darkText: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSize: string;
    lineHeight: string;
    letterSpacing: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  containerWidth: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  buttons: {
    borderRadius: string;
    fontWeight: string;
    paddingX: string;
    paddingY: string;
  };
  darkMode: {
    enabled: boolean;
    strategy: 'class' | 'media';
  };
}
