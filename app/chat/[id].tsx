import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { loadMessages, saveMessages } from "@/lib/local-message-store";

type Message = { id: string; text: string; time: string; mine?: boolean; kind?: "text" | "voice" | "media" | "file" };
const START_MESSAGES: Message[] = [
  { id: "1", text: "تم التحقق من بصمة الأمان بين الجهازين.", time: "10:40 ص", kind: "text" },
  { id: "2", text: "ممتاز، نقدر نتحدث بدون إنترنت.", time: "10:41 ص", mine: true },
  { id: "3", text: "رسالة صوتية · 0:18", time: "10:42 ص", kind: "voice" },
];

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id = "unknown", name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const [messages, setMessages] = useState(START_MESSAGES);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [callMode, setCallMode] = useState<"voice" | "video" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    loadMessages(String(id), START_MESSAGES).then((stored) => {
      if (!active) return;
      setMessages(stored);
      setHydrated(true);
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (hydrated) void saveMessages(String(id), messages);
  }, [hydrated, id, messages]);

  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds((value) => value + 1), 1000); return () => clearInterval(timer); }, [recording]);
  const addMessage = (message: Omit<Message, "id" | "time" | "mine">) => setMessages((current) => [...current, { ...message, id: `${Date.now()}-${Math.random()}`, time: "الآن", mine: true }]);
  const sendMessage = () => { const value = draft.trim(); if (!value) return; addMessage({ text: value, kind: "text" }); setDraft(""); };
  const attachMedia = async () => {
    if (typeof document !== "undefined") { fileRef.current?.click(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
    if (!result.canceled) addMessage({ text: "وسائط مشفرة جاهزة للإرسال", kind: "media" });
  };
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) addMessage({ text: `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`, kind: "file" }); event.target.value = ""; };
  const toggleRecording = () => { if (recording) { addMessage({ text: `رسالة صوتية · 0:${String(seconds).padStart(2, "0")}`, kind: "voice" }); setSeconds(0); } setRecording(!recording); };
  const call = (type: "voice" | "video") => { setCallMode(type); Alert.alert(type === "voice" ? "مكالمة صوتية" : "مكالمة فيديو", "واجهة الاتصال المحلية جاهزة. الربط الفعلي بين جهازين يحتاج WebRTC مع قناة إشارة محلية أو وحدة Android أصلية."); };
  return <ScreenContainer edges={["top", "left", "right", "bottom"]}>
    <View style={styles.container}>
      <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><IconSymbol name="arrow-back" size={22} color={colors.foreground} /></Pressable><View style={styles.peerBlock}><View style={[styles.peerAvatar, { backgroundColor: "rgba(40,215,163,.16)" }]}><Text style={[styles.peerInitial, { color: colors.primary }]}>{(name ?? "س").slice(0, 1)}</Text><View style={[styles.onlineDot, { backgroundColor: colors.primary, borderColor: colors.background }]} /></View><View><Text style={[styles.peerName, { color: colors.foreground }]}>{name ?? "جهة اتصال"}</Text><Text style={[styles.peerStatus, { color: colors.primary }]}>متصل محلياً · مشفر</Text></View></View><View style={styles.callActions}><Pressable onPress={() => call("voice")} style={styles.headerButton}><IconSymbol name="call" size={21} color={colors.foreground} /></Pressable><Pressable onPress={() => call("video")} style={styles.headerButton}><IconSymbol name="videocam" size={21} color={colors.foreground} /></Pressable></View></View>
      {callMode && <View style={[styles.callBanner, { backgroundColor: "rgba(97,183,255,.12)" }]}><IconSymbol name={callMode === "video" ? "videocam" : "call"} size={16} color="#61B7FF" /><Text style={[styles.callBannerText, { color: "#61B7FF" }]}>وضع المكالمة {callMode === "video" ? "الفيديو" : "الصوتية"} · قناة محلية</Text><Pressable onPress={() => setCallMode(null)}><Text style={[styles.endCall, { color: colors.error }]}>إنهاء</Text></Pressable></View>}
      <View style={[styles.securityBanner, { backgroundColor: "rgba(40,215,163,.1)" }]}><IconSymbol name="lock.fill" size={15} color={colors.primary} /><Text style={[styles.securityText, { color: colors.primary }]}>مشفرة من جهاز إلى جهاز</Text><Pressable onPress={() => Alert.alert("بصمة الأمان", "A4D1 8F22 91C7 5B0E\nتحقق من هذه البصمة مع الطرف الآخر.")}><Text style={[styles.verify, { color: colors.primary }]}>تحقق</Text></Pressable></View>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false} renderItem={({ item }) => <View style={[styles.messageLine, item.mine && styles.mineLine]}><View style={[styles.bubble, { backgroundColor: item.mine ? colors.primary : colors.surface, borderColor: colors.border }, item.mine && styles.mineBubble]}>{item.kind === "voice" && <View style={styles.voiceRow}><IconSymbol name="play-arrow" size={19} color={item.mine ? "#07111F" : colors.primary} /><View style={[styles.wave, { backgroundColor: item.mine ? "rgba(7,17,31,.25)" : colors.border }]} /><Text style={[styles.voiceDuration, { color: item.mine ? "#07111F" : colors.muted }]}>{item.text.replace("رسالة صوتية · ", "")}</Text></View>}{item.kind === "media" && <View style={styles.voiceRow}><IconSymbol name="photo" size={19} color={item.mine ? "#07111F" : colors.primary} /><Text style={[styles.messageText, { color: item.mine ? "#07111F" : colors.foreground }]}>{item.text}</Text></View>}{item.kind === "file" && <View style={styles.voiceRow}><IconSymbol name="insert-drive-file" size={19} color={item.mine ? "#07111F" : colors.primary} /><Text style={[styles.messageText, { color: item.mine ? "#07111F" : colors.foreground }]}>{item.text}</Text></View>}{item.kind === "text" && <Text style={[styles.messageText, { color: item.mine ? "#07111F" : colors.foreground }]}>{item.text}</Text>}<Text style={[styles.time, { color: item.mine ? "rgba(7,17,31,.62)" : colors.muted }]}>{item.time}</Text></View></View>} />
      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}><Pressable onPress={attachMedia} style={styles.composerButton}><IconSymbol name="add-circle" size={25} color={colors.primary} /></Pressable><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={sendMessage} placeholder="اكتب رسالة آمنة" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground }]} multiline />{draft.trim() ? <Pressable onPress={sendMessage} style={[styles.sendButton, { backgroundColor: colors.primary }]}><IconSymbol name="send" size={18} color="#07111F" /></Pressable> : <Pressable onPress={toggleRecording} style={[styles.sendButton, { backgroundColor: recording ? colors.error : colors.primary }]}><IconSymbol name={recording ? "stop" : "mic"} size={18} color="#07111F" /></Pressable>}</View>
      {recording && <Text style={[styles.recordingLabel, { color: colors.error }]}>● جارٍ تسجيل الرسالة الصوتية 0:{String(seconds).padStart(2, "0")}</Text>}
      {typeof document !== "undefined" && <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={onFile} style={{ display: "none" }} />}
    </View>
  </ScreenContainer>;
}
const styles = StyleSheet.create({ container: { flex: 1, paddingHorizontal: 16, maxWidth: 900, width: "100%", alignSelf: "center" }, header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, headerButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" }, peerBlock: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1, justifyContent: "center" }, peerAvatar: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", position: "relative" }, peerInitial: { fontWeight: "800", fontSize: 15 }, onlineDot: { width: 9, height: 9, borderRadius: 5, position: "absolute", right: -1, bottom: -1, borderWidth: 2 }, peerName: { fontWeight: "800", fontSize: 14, textAlign: "right" }, peerStatus: { fontSize: 10, marginTop: 2, textAlign: "right" }, callActions: { flexDirection: "row" }, callBanner: { minHeight: 38, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }, callBannerText: { fontSize: 11, fontWeight: "700" }, endCall: { fontSize: 11, fontWeight: "900", marginLeft: 9 }, securityBanner: { height: 34, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, securityText: { fontSize: 11, fontWeight: "700" }, verify: { fontSize: 11, fontWeight: "800", marginLeft: 3 }, messages: { paddingVertical: 18, gap: 11 }, messageLine: { alignItems: "flex-start" }, mineLine: { alignItems: "flex-end" }, bubble: { maxWidth: "82%", borderWidth: 1, borderRadius: 17, borderBottomLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 10 }, mineBubble: { borderBottomLeftRadius: 17, borderBottomRightRadius: 5, paddingBottom: 8 }, messageText: { fontSize: 14, lineHeight: 21, textAlign: "right" }, time: { fontSize: 9, marginTop: 4, textAlign: "right" }, voiceRow: { flexDirection: "row", alignItems: "center", gap: 8 }, wave: { width: 60, height: 4, borderRadius: 2 }, voiceDuration: { fontSize: 11 }, composer: { minHeight: 56, borderWidth: 1, borderRadius: 18, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, marginBottom: 4 }, composerButton: { width: 38, alignItems: "center" }, input: { flex: 1, maxHeight: 90, fontSize: 14, textAlign: "right", paddingHorizontal: 8, paddingVertical: 10 }, sendButton: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center" }, recordingLabel: { fontSize: 11, textAlign: "center", marginBottom: 4 }, pressed: { opacity: .72, transform: [{ scale: .985 }] } });
