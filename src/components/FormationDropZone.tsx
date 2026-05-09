import React, { useRef } from 'react';
import { LayoutChangeEvent, View, type StyleProp, type ViewStyle } from 'react-native';

export type DropRect = { x: number; y: number; w: number; h: number };
export type ZoneMap = Map<string, DropRect>;

type Props = {
  zoneKey: string;
  zonesRef: React.MutableRefObject<ZoneMap>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Basılı tut-sürükle hedefi için measureInWindow ile dikdörtgen kaydı. */
export function FormationDropZone({ zoneKey, zonesRef, style, children }: Props) {
  const ref = useRef<View>(null);
  const measure = (_e?: LayoutChangeEvent) => {
    ref.current?.measureInWindow((x, y, w, h) => {
      zonesRef.current.set(zoneKey, { x, y, w, h });
    });
  };
  return (
    <View ref={ref} onLayout={measure} style={style} collapsable={false}>
      {children}
    </View>
  );
}
