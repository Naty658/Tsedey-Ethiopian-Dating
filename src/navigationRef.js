// src/navigationRef.js
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const getActiveScreen = () =>
  navigationRef.getCurrentRoute()?.name ?? 'unknown-screen';