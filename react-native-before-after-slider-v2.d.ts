declare module 'react-native-before-after-slider-v2' {
  import * as React from 'react';
    import { ViewProps } from 'react-native';

  export interface CompareProps extends ViewProps {
    width?: number;
    height?: number;
    draggerWidth?: number;
    initial?: number;
    onMoveStart?: () => void;
    onMove?: (position: number) => void;
    onMoveEnd?: () => void;
    children?: React.ReactNode;
  }

  export const Before: React.ComponentType<{ children?: React.ReactNode }>;
  export const After: React.ComponentType<{ children?: React.ReactNode }>;
  export const DefaultDragger: React.ComponentType;
  export const Dragger: React.ComponentType<{ children?: React.ReactNode }>;

  const Compare: React.ComponentType<CompareProps>;
  export default Compare;
}
