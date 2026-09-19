import { requireNativeView } from 'expo';
import * as React from 'react';

import { SecureChatConnectivityViewProps } from './SecureChatConnectivity.types';

const NativeView: React.ComponentType<SecureChatConnectivityViewProps> =
  requireNativeView('SecureChatConnectivity');

export default function SecureChatConnectivityView(props: SecureChatConnectivityViewProps) {
  return <NativeView {...props} />;
}
