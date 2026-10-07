export const WEB_FONT_FAMILIES = [
  ["Roboto", '"Roboto", Arial, sans-serif'],
  ["Open Sans", '"Open Sans", Arial, sans-serif'],
  ["Lato", '"Lato", Arial, sans-serif'],
  ["Montserrat", '"Montserrat", Arial, sans-serif'],
  ["Poppins", '"Poppins", Arial, sans-serif'],
  ["Raleway", '"Raleway", Arial, sans-serif'],
  ["Nunito", '"Nunito", Arial, sans-serif'],
  ["Ubuntu", '"Ubuntu", Arial, sans-serif'],
  ["Merriweather", '"Merriweather", Georgia, serif'],
  ["Playfair Display", '"Playfair Display", Georgia, serif']
];

export const WEB_FONTS_URL = 'https://fonts.googleapis.com/css2?'
  + WEB_FONT_FAMILIES.map(([name]) => `family=${name.replaceAll(' ', '+')}:ital,wght@0,400;0,700;1,400;1,700`).join('&')
  + '&display=swap';

export function loadEditorFonts(doc = document) {
  if (doc.querySelector('link[data-rcms-fonts]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = WEB_FONTS_URL;
  link.setAttribute('data-rcms-fonts', 'true');
  doc.head.appendChild(link);
}
