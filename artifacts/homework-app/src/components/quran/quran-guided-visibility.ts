const GUIDED_READER_EDGE_PADDING = 16;

interface VerticalBounds {
  top: number;
  bottom: number;
  height: number;
}

export function getGuidedVerseScrollDelta(
  verse: VerticalBounds,
  reader: VerticalBounds,
  panelTop: number | null,
): number | null {
  const readableTop = reader.top + GUIDED_READER_EDGE_PADDING;
  const readableBottom = Math.min(
    reader.bottom - GUIDED_READER_EDGE_PADDING,
    panelTop === null ? reader.bottom - GUIDED_READER_EDGE_PADDING : panelTop - GUIDED_READER_EDGE_PADDING,
  );
  const readableHeight = readableBottom - readableTop;

  if (verse.height > readableHeight) {
    return verse.top - readableTop;
  }
  if (verse.top < readableTop) return verse.top - readableTop;
  if (verse.bottom > readableBottom) return verse.bottom - readableBottom;
  return null;
}