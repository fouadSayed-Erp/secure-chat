import { registerWebModule, NativeModule } from 'expo';

class SecureChatConnectivityModule extends NativeModule {
  getStatus() {
    return { bluetoothAvailable: false, bluetoothEnabled: false, wifiTransport: false, internetValidated: typeof navigator !== 'undefined' && navigator.onLine, androidApi: 0 };
  }
  async requestNearbyPermissions() { return false; }
  async requestMediaPermissions() { return false; }
  requestBluetoothEnable() { return false; }
  async startBluetoothDiscovery() { return false; }
  openHotspotSettings() { return false; }
  openAppSettings() { return false; }
}

export default registerWebModule(SecureChatConnectivityModule, 'SecureChatConnectivityModule');
