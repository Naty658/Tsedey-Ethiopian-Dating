// src/fbDebug.ts
import { getActiveScreen } from './navigationRef';

export const logFirebaseErr = (label: string, e: any) => {
  const screen = getActiveScreen();
  const callsite = new Error(`CALLSITE: ${label}`).stack;

  console.log(`🔥 FirebaseError @${screen} | ${label}`, {
    code: e?.code,
    message: e?.message,
    native: e?.nativeErrorCode,
    details: e?.nativeErrorMessage,
    stack: e?.stack,
    callsite,
  });
};
