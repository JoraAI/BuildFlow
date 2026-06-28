// Web shim for react-native-maps - no-op for browser builds
import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ children, style }) =>
  React.createElement(View, { style }, children);

MapView.Marker = ({ children }) => React.createElement(React.Fragment, null, children);
MapView.Callout = ({ children }) => React.createElement(React.Fragment, null, children);
MapView.Polygon = () => null;
MapView.Polyline = () => null;
MapView.Circle = () => null;

export { MapView };
export default MapView;
export const Marker = MapView.Marker;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;