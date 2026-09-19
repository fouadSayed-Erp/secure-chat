import { NativeModule, requireNativeModule } from 'expo';

export type ConnectivityStatus = {
  bluetoothAvailable: boolean;
  bluetoothEnabled: boolean;
  wifiTransport: boolean;
  internetValidated: boolean;
  androidApi: number;
};

declare class SecureChatConnectivityModule extends NativeModule {
  getStatus(): ConnectivityStatus;
  requestNearbyPermissions(): Promise<boolean>;
  requestMediaPermissions(): Promise<boolean>;
  requestBluetoothEnable(): boolean;
  startBluetoothDiscovery(): Promise<boolean>;
  openHotspotSettings(): boolean;
  openAppSettings(): boolean;
}

export default requireNativeModule<SecureChatConnectivityModule>('SecureChatConnectivity');
