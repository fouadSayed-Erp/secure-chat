import * as React from 'react';

import { SecureChatConnectivityViewProps } from './SecureChatConnectivity.types';

export default function SecureChatConnectivityView(props: SecureChatConnectivityViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
