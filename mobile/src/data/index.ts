import React, { type ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { ExtrasProvider } from './ExtrasContext';
import { WorkspaceProvider } from './WorkspaceContext';

export { useAuth, defaultNativePreferences } from './AuthContext';
export type { AuthContextValue, AuthPhase, AuthProfile, FeedbackKind, NativePreferences, OnboardingInput, Party, ProfilePatch, SupabaseConfig } from './AuthContext';
export { isUpiId } from './AuthContext';
export { useWorkspace } from './WorkspaceContext';
export type { WorkspaceStatus } from './WorkspaceContext';
export { useExtras } from './ExtrasContext';
export type { ExtrasStatus } from './ExtrasContext';
export { API_BASE_URL } from './backend';
export * from './extras';
export * from './model';

export function DataProvider({ children }: { children: ReactNode }) {
  return React.createElement(AuthProvider, null,
    React.createElement(WorkspaceProvider, null, React.createElement(ExtrasProvider, null, children)));
}
