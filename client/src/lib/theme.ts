// Function to load saved theme or set default
export const loadTheme = () => {
  // Get saved theme or set default to red
  const primaryColor = localStorage.getItem('theme_color') || '#e11d48';
  const primaryColorLight = localStorage.getItem('theme_color_light') || '#f43f5e';
  const primaryColorDark = localStorage.getItem('theme_color_dark') || '#be123c';
  
  // Set CSS variables for the theme
  document.documentElement.style.setProperty('--color-primary', primaryColor);
  document.documentElement.style.setProperty('--color-primary-light', primaryColorLight);
  document.documentElement.style.setProperty('--color-primary-dark', primaryColorDark);
  
  return { primaryColor, primaryColorLight, primaryColorDark };
};