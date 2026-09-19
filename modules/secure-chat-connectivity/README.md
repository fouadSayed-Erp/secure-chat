# SecureChatConnectivity

وحدة Expo Native لمنصة Android تجمع وظائف الاتصال القريب المطلوبة لتطبيق Secure Chat.

## API

- `getStatus()` يرجع حالة Bluetooth واتصال Wi‑Fi وإصدار Android.
- `requestNearbyPermissions()` يطلب أذونات Bluetooth وNearby Wi‑Fi المناسبة لإصدار Android.
- `requestMediaPermissions()` يطلب أذونات الكاميرا والميكروفون.
- `requestBluetoothEnable()` يفتح حوار Android الرسمي لتفعيل Bluetooth.
- `startBluetoothDiscovery()` يبدأ discovery بعد منح الأذونات.
- `openHotspotSettings()` يفتح إعدادات الاتصال اللاسلكي/Hotspot.
- `openAppSettings()` يفتح إعدادات أذونات التطبيق.

## الاستخدام

```ts
import ConnectivityModule from '@/modules/secure-chat-connectivity/src/SecureChatConnectivityModule';

await ConnectivityModule.requestNearbyPermissions();
await ConnectivityModule.requestMediaPermissions();
const status = ConnectivityModule.getStatus();
```

## ملاحظة Hotspot

Android يقيّد تشغيل Hotspot برمجياً على التطبيقات العادية وإصدارات النظام الحديثة. لذلك تفتح الوحدة شاشة الإعدادات الرسمية بدلاً من تجاوز حماية النظام. تشغيل Hotspot تلقائياً يتطلب تطبيقاً بصلاحية نظام/إدارة جهاز أو مسار Android خاصاً بالجهاز.

## إعادة البناء

لأن الكود Native، يلزم إعادة بناء التطبيق بعد أي تعديل:

```bash
npx expo prebuild --platform android
npx expo run:android
```

أو أنشئ Development Build عبر EAS. Expo Go لن يحمّل هذه الوحدة المحلية.
