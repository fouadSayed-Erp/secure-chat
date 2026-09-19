import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { normalizeUsername, validateLocalLogin } from "@/lib/auth-utils";
import { nativeConnectivity } from "@/lib/native-connectivity";

type Chat = { id: string; name: string; initials: string; message: string; time: string; unread?: number; online: boolean; accent: string };
const SESSION_KEY = "secure-chat-web-session";
const ACCOUNT_KEY = "secure-chat-local-account";
const INITIAL_CHATS: Chat[] = [
  { id: "1", name: "سارة أحمد", initials: "سأ", message: "تم التحقق من بصمة الأمان", time: "10:42 ص", unread: 2, online: true, accent: "#28D7A3" },
  { id: "2", name: "جهاز محمد", initials: "جم", message: "رسالة صوتية · 0:18", time: "أمس", online: true, accent: "#61B7FF" },
  { id: "3", name: "فريق الرحلة", initials: "فر", message: "أرسل خالد صورة", time: "أمس", unread: 5, online: false, accent: "#B28CFF" },
];

function LoginGate({ onLogin }: { onLogin: (username: string) => void }) {
  const colors = useColors();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const validation = validateLocalLogin(username, password);
    if (!validation.valid) return setError(validation.reason);
    const normalizedUsername = normalizeUsername(username);
    if (typeof localStorage !== "undefined") {
      const existing = localStorage.getItem(ACCOUNT_KEY);
      if (existing && JSON.parse(existing).username === normalizedUsername && JSON.parse(existing).password !== password) return setError("كلمة المرور غير صحيحة لهذا الجهاز.");
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ username: normalizedUsername, password }));
    }
    onLogin(normalizedUsername);
  };
  return <ScreenContainer edges={["top", "left", "right", "bottom"]}>
    <View style={styles.loginPage}>
      <View style={styles.loginGlow} />
      <View style={[styles.logo, { backgroundColor: colors.primary }]}><IconSymbol name="lock.fill" size={27} color="#07111F" /></View>
      <Text style={[styles.loginTitle, { color: colors.foreground }]}>Secure Chat</Text>
      <Text style={[styles.loginCaption, { color: colors.muted }]}>محادثات خاصة. محلية. بلا أثر على الخادم.</Text>
      <View style={[styles.loginCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardEyebrow, { color: colors.primary }]}>دخول آمن محلي</Text>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>اسم المستخدم</Text>
        <TextInput value={username} onChangeText={setUsername} placeholder="مثال: ahmed" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.loginInput, { color: colors.foreground, borderColor: colors.border }]} />
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>كلمة المرور</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry style={[styles.loginInput, { color: colors.foreground, borderColor: colors.border }]} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={submit} style={({ pressed }) => [styles.loginButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.loginButtonText}>دخول إلى المحادثات</Text><IconSymbol name="arrow-forward" size={18} color="#07111F" /></Pressable>
        <View style={styles.localNote}><IconSymbol name="shield" size={16} color={colors.primary} /><Text style={[styles.localNoteText, { color: colors.muted }]}>يُحفظ الحساب على هذا الجهاز فقط، والجلسة تنتهي عند تسجيل الخروج.</Text></View>
      </View>
    </View>
  </ScreenContainer>;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chats] = useState(INITIAL_CHATS);
  const [connected, setConnected] = useState(true);
  const [permissions, setPermissions] = useState(false);
  useEffect(() => { if (typeof sessionStorage !== "undefined") setUser(sessionStorage.getItem(SESSION_KEY)); }, []);
  if (!user) return <LoginGate onLogin={(name) => { sessionStorage?.setItem(SESSION_KEY, name); setUser(name); }} />;
  const filteredChats = useMemo(() => chats.filter((chat) => chat.name.includes(query) || chat.message.includes(query)), [chats, query]);
  const startNewChat = () => Alert.alert("الأجهزة القريبة", "في الويب يمكن استخدام المشاركة القريبة عبر Web Share عند دعمها. النقل المباشر عبر Bluetooth/Quick Share يحتاج تطبيق Android أصلياً أو WebRTC بإشارة محلية.");
  const requestPermissions = async () => {
    try {
      if (Platform.OS === "android" && nativeConnectivity) {
        await nativeConnectivity.requestNearbyPermissions();
        await nativeConnectivity.requestMediaPermissions();
      } else if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      }
      setPermissions(true);
      Alert.alert("تم طلب الأذونات", "إذا لم تظهر نافذة النظام، افتح إعدادات التطبيق وفعّل الكاميرا والميكروفون والأجهزة القريبة.");
    } catch { Alert.alert("الأذونات مطلوبة", "افتح إعدادات Secure Chat وفعّل أذونات الكاميرا والميكروفون والأجهزة القريبة."); }
  };
  const inspectLocalConnection = () => {
    const connectivity = nativeConnectivity;
    if (Platform.OS === "android" && connectivity) {
      const status = connectivity.getStatus();
      setConnected(status.wifiTransport || status.bluetoothEnabled);
      if (!status.wifiTransport && !status.bluetoothEnabled) {
        Alert.alert("الاتصال المحلي غير جاهز", "فعّل Wi‑Fi Hotspot أو Bluetooth من إعدادات Android.", [
          { text: "إلغاء", style: "cancel" },
          { text: "فتح إعدادات الاتصال", onPress: () => connectivity.openHotspotSettings() },
        ]);
      }
      return;
    }
    setConnected(!connected);
  };
  return <ScreenContainer edges={["top", "left", "right", "bottom"]}>
    <View style={styles.container}>
      <View style={styles.topbar}><View><View style={styles.brandLine}><View style={[styles.brandMark, { backgroundColor: colors.primary }]}><IconSymbol name="lock.fill" size={18} color="#07111F" /></View><Text style={[styles.brand, { color: colors.foreground }]}>Secure Chat</Text></View><Text style={[styles.subtitle, { color: colors.muted }]}>مرحباً {user} · خصوصية محلية، بدون إنترنت</Text></View><Pressable onPress={() => { sessionStorage?.removeItem(SESSION_KEY); setUser(null); }} style={[styles.logout, { borderColor: colors.border }]}><IconSymbol name="logout" size={18} color={colors.muted} /><Text style={[styles.logoutText, { color: colors.muted }]}>خروج</Text></Pressable></View>
      <View style={styles.heroRow}><View><Text style={[styles.heading, { color: colors.foreground }]}>مساحتك الخاصة</Text><Text style={[styles.headingCaption, { color: colors.muted }]}>اتصل بجهاز قريب وابدأ محادثة مشفرة.</Text></View><Pressable onPress={requestPermissions} style={({ pressed }) => [styles.permissionButton, { backgroundColor: permissions ? "rgba(40,215,163,.14)" : colors.primary }, pressed && styles.pressed]}><IconSymbol name={permissions ? "check-circle" : "verified-user"} size={17} color={permissions ? colors.primary : "#07111F"} /><Text style={[styles.permissionText, { color: permissions ? colors.primary : "#07111F" }]}>{permissions ? "الأذونات مفعلة" : "منح الأذونات"}</Text></Pressable></View>
      <Pressable onPress={inspectLocalConnection} style={({ pressed }) => [styles.connectionCard, { backgroundColor: colors.surface, borderColor: connected ? "rgba(40,215,163,.35)" : colors.border }, pressed && styles.pressed]}><View style={[styles.signalIcon, { backgroundColor: connected ? "rgba(40,215,163,.15)" : "rgba(245,185,76,.15)" }]}><IconSymbol name={connected ? "wifi" : "bluetooth"} size={23} color={connected ? colors.primary : colors.warning} /></View><View style={styles.connectionText}><Text style={[styles.connectionTitle, { color: colors.foreground }]}>{connected ? "قناة محلية جاهزة" : "لا يوجد جهاز قريب"}</Text><Text style={[styles.connectionCaption, { color: colors.muted }]}>{connected ? "Wi‑Fi Hotspot · التشفير الطرفي جاهز" : "فعّل Bluetooth أو نقطة اتصال للبحث"}</Text></View><View style={[styles.statusPill, { backgroundColor: connected ? "rgba(40,215,163,.12)" : "rgba(245,185,76,.12)" }]}><View style={[styles.statusDot, { backgroundColor: connected ? colors.primary : colors.warning }]} /><Text style={[styles.statusText, { color: connected ? colors.primary : colors.warning }]}>{connected ? "متصل" : "بحث"}</Text></View></Pressable>
      <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>المحادثات</Text><Text style={[styles.sectionCaption, { color: colors.muted }]}>كل البيانات تبقى على جهازك</Text></View><Pressable onPress={startNewChat} style={({ pressed }) => [styles.newButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><IconSymbol name="add" size={18} color="#07111F" /><Text style={styles.newButtonText}>محادثة جديدة</Text></Pressable></View>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="search" size={20} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="البحث في المحادثات" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} /></View>
      <FlatList data={filteredChats} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.name } })} style={({ pressed }) => [styles.chatRow, { borderBottomColor: colors.border }, pressed && styles.pressed]}><View style={[styles.avatar, { backgroundColor: `${item.accent}22` }]}><Text style={[styles.avatarText, { color: item.accent }]}>{item.initials}</Text>{item.online && <View style={[styles.onlineDot, { backgroundColor: colors.primary, borderColor: colors.background }]} />}</View><View style={styles.chatInfo}><View style={styles.chatTopLine}><Text style={[styles.chatName, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.chatTime, { color: colors.muted }]}>{item.time}</Text></View><View style={styles.chatBottomLine}><Text numberOfLines={1} style={[styles.chatMessage, { color: colors.muted }]}>{item.message}</Text>{item.unread && <View style={[styles.unread, { backgroundColor: colors.primary }]}><Text style={styles.unreadText}>{item.unread}</Text></View>}</View></View><IconSymbol name="chevron.right" size={18} color={colors.muted} /></Pressable>} ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>لا توجد محادثات مطابقة.</Text>} />
      <View style={[styles.footerCard, { backgroundColor: colors.surface }]}><View style={[styles.footerIcon, { backgroundColor: "rgba(97,183,255,.14)" }]}><IconSymbol name="shield" size={20} color="#61B7FF" /></View><View style={styles.footerText}><Text style={[styles.footerTitle, { color: colors.foreground }]}>تشفير طرفي محلي</Text><Text style={[styles.footerCaption, { color: colors.muted }]}>لا يوجد خادم يقرأ محتوى رسائلك</Text></View><IconSymbol name="check-circle" size={20} color={colors.primary} /></View>
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ container: { flex: 1, paddingHorizontal: 22, maxWidth: 980, width: "100%", alignSelf: "center" }, topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 24 }, brandLine: { flexDirection: "row", alignItems: "center", gap: 9 }, brandMark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, brand: { fontSize: 23, fontWeight: "800", letterSpacing: -0.5 }, subtitle: { fontSize: 12, marginTop: 5, marginLeft: 41 }, logout: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 }, logoutText: { fontSize: 12, fontWeight: "700" }, heroRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }, heading: { fontSize: 28, fontWeight: "800" }, headingCaption: { fontSize: 13, marginTop: 5 }, permissionButton: { flexDirection: "row", gap: 7, alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, permissionText: { fontSize: 12, fontWeight: "800" }, connectionCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, signalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, connectionText: { flex: 1 }, connectionTitle: { fontSize: 15, fontWeight: "700" }, connectionCaption: { fontSize: 12, marginTop: 4 }, statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }, statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { fontSize: 11, fontWeight: "800" }, sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 30, marginBottom: 14 }, sectionTitle: { fontSize: 21, fontWeight: "800" }, sectionCaption: { fontSize: 11, marginTop: 4 }, newButton: { borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 9 }, newButtonText: { color: "#07111F", fontSize: 12, fontWeight: "800" }, searchBox: { height: 48, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 }, searchInput: { flex: 1, fontSize: 14, textAlign: "right" }, list: { paddingTop: 8, paddingBottom: 12 }, chatRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth }, avatar: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", position: "relative" }, avatarText: { fontSize: 16, fontWeight: "800" }, onlineDot: { width: 11, height: 11, borderRadius: 6, position: "absolute", right: -1, bottom: -1, borderWidth: 2 }, chatInfo: { flex: 1, gap: 7 }, chatTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, chatBottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, chatName: { fontSize: 15, fontWeight: "700" }, chatTime: { fontSize: 11 }, chatMessage: { fontSize: 13, flex: 1 }, unread: { minWidth: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center" }, unreadText: { color: "#07111F", fontSize: 11, fontWeight: "800" }, empty: { textAlign: "center", padding: 24 }, footerCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, padding: 13, marginBottom: 8 }, footerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" }, footerText: { flex: 1 }, footerTitle: { fontSize: 13, fontWeight: "700" }, footerCaption: { fontSize: 11, marginTop: 3 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, loginPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 }, loginGlow: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(40,215,163,.06)" }, logo: { width: 64, height: 64, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: 14 }, loginTitle: { fontSize: 32, fontWeight: "900" }, loginCaption: { fontSize: 13, marginTop: 7, marginBottom: 28 }, loginCard: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 22 }, cardEyebrow: { fontSize: 12, fontWeight: "800", marginBottom: 22 }, fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 7, textAlign: "right" }, loginInput: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginBottom: 16, textAlign: "right" }, error: { color: "#FF7B89", fontSize: 12, textAlign: "right", marginBottom: 10 }, loginButton: { height: 48, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, loginButtonText: { color: "#07111F", fontWeight: "900", fontSize: 13 }, localNote: { flexDirection: "row", gap: 7, alignItems: "center", marginTop: 18 }, localNoteText: { flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" } });

function sessionStorageSafe() { return typeof sessionStorage !== "undefined" ? sessionStorage : null; }
void sessionStorageSafe;
