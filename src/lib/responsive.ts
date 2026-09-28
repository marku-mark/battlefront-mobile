export const MAX_CONTENT_WIDTH = 1280;

export type ResponsiveLayout = {
  isTablet: boolean;
  isExpanded: boolean;
  contentWidth: number;
  horizontalPadding: number;
  productColumns: number;
};

export function getResponsiveLayout(windowWidth: number): ResponsiveLayout {
  const isTablet = windowWidth >= 600;
  const isExpanded = windowWidth >= 900;

  return {
    isTablet,
    isExpanded,
    contentWidth: Math.min(windowWidth, MAX_CONTENT_WIDTH),
    horizontalPadding: isTablet ? 24 : 16,
    productColumns: windowWidth >= 1024 ? 4 : windowWidth >= 640 ? 3 : 2,
  };
}

export function getGridCardWidth(
  windowWidth: number,
  columns: number,
  horizontalPadding = 10,
  itemPadding = 6,
): number {
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);
  return (contentWidth - horizontalPadding * 2) / columns - itemPadding * 2;
}