import { Platform } from "react-native";
import ConnectivityModule from "@/modules/secure-chat-connectivity/src/SecureChatConnectivityModule";

export const nativeConnectivity = Platform.OS === "android" ? ConnectivityModule : null;
