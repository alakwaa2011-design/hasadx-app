import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, PanResponder, type GestureResponderEvent, type LayoutChangeEvent,
  type NativeTouchEvent,
} from 'react-native';

type Point = { x: number; y: number };
type Zoom = { scale: number; x: number; y: number };
type Pinch = { distance: number; midpoint: Point; zoom: Zoom };
type Pan = { point: Point; zoom: Zoom };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const point = (touch: NativeTouchEvent): Point => ({ x: touch.pageX, y: touch.pageY });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function usePageZoom({
  page, display, readingMode, viewportWidth, viewportHeight, pageWidth, pageHeight, onTurn,
}: {
  page: number;
  display: string;
  readingMode: boolean;
  viewportWidth: number;
  viewportHeight: number;
  pageWidth: number;
  pageHeight: number;
  onTurn: (direction: -1 | 1) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const current = useRef<Zoom>({ scale: 1, x: 0, y: 0 });
  const stage = useRef({ x: 0, y: 0, width: viewportWidth, height: viewportHeight });
  const pinch = useRef<Pinch | null>(null);
  const pan = useRef<Pan | null>(null);
  const hadPinch = useRef(false);
  const turnRef = useRef(onTurn);
  turnRef.current = onTurn;
  const [zoomed, setZoomed] = useState(false);

  const update = useCallback((next: Zoom) => {
    const adjustedScale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const maxX = Math.max(0, (pageWidth * adjustedScale - stage.current.width) / 2);
    const maxY = Math.max(0, (pageHeight * adjustedScale - stage.current.height) / 2);
    const adjusted = {
      scale: adjustedScale,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
    current.current = adjusted;
    scale.setValue(adjusted.scale);
    translateX.setValue(adjusted.x);
    translateY.setValue(adjusted.y);
  }, [pageWidth, pageHeight, scale, translateX, translateY]);

  const reset = useCallback(() => {
    current.current = { scale: 1, x: 0, y: 0 };
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    pinch.current = null;
    pan.current = null;
    hadPinch.current = false;
    setZoomed(false);
  }, [scale, translateX, translateY]);

  useEffect(() => { reset(); }, [page, display, readingMode, viewportWidth, viewportHeight, pageWidth, pageHeight, reset]);

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    stage.current = { x, y, width, height };
  }, []);

  const responders = useMemo(() => {
    const startPinch = (a: Point, b: Point) => {
      pinch.current = { distance: Math.max(1, distance(a, b)), midpoint: midpoint(a, b), zoom: { ...current.current } };
      pan.current = null;
      hadPinch.current = true;
    };
    const startPan = (touch: Point) => {
      pan.current = { point: touch, zoom: { ...current.current } };
      pinch.current = null;
    };
    const twoTouches = (event: GestureResponderEvent) => event.nativeEvent.touches.length >= 2;
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: twoTouches,
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        if (twoTouches(event)) return true;
        if (current.current.scale > 1.01) return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
        return Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onMoveShouldSetPanResponder: (event, gesture) => {
        if (twoTouches(event)) return true;
        if (current.current.scale > 1.01) return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
        return Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderGrant: event => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) startPinch(point(touches[0]), point(touches[1]));
        else if (touches.length === 1 && current.current.scale > 1.01) startPan(point(touches[0]));
      },
      onPanResponderMove: event => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          const a = point(touches[0]);
          const b = point(touches[1]);
          if (!pinch.current) startPinch(a, b);
          const start = pinch.current!;
          const nextScale = clamp(start.zoom.scale * distance(a, b) / start.distance, MIN_SCALE, MAX_SCALE);
          const ratio = nextScale / start.zoom.scale;
          const center = { x: stage.current.x + stage.current.width / 2, y: stage.current.y + stage.current.height / 2 };
          const focus = midpoint(a, b);
          update({
            scale: nextScale,
            x: focus.x - center.x + ratio * (start.zoom.x - (start.midpoint.x - center.x)),
            y: focus.y - center.y + ratio * (start.zoom.y - (start.midpoint.y - center.y)),
          });
          return;
        }
        if (touches.length !== 1) return;
        if (pinch.current) startPan(point(touches[0]));
        if (current.current.scale <= 1.01) return;
        if (!pan.current) startPan(point(touches[0]));
        const start = pan.current!;
        const position = point(touches[0]);
        update({
          scale: start.zoom.scale,
          x: start.zoom.x + position.x - start.point.x,
          y: start.zoom.y + position.y - start.point.y,
        });
      },
      onPanResponderRelease: (_, gesture) => {
        if (!hadPinch.current && current.current.scale <= 1.01
          && Math.abs(gesture.dx) > 55 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5) {
          turnRef.current(gesture.dx > 0 ? 1 : -1);
        }
        setZoomed(current.current.scale > 1.01);
        pinch.current = null;
        pan.current = null;
        hadPinch.current = false;
      },
      onPanResponderTerminate: () => {
        setZoomed(current.current.scale > 1.01);
        pinch.current = null;
        pan.current = null;
        hadPinch.current = false;
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [update]);

  return {
    panHandlers: responders.panHandlers,
    onStageLayout,
    zoomStyle: { transform: [{ translateX }, { translateY }, { scale }] },
    zoomed,
    resetZoom: reset,
  };
}