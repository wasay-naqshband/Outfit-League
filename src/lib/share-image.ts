import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

export async function sharePreview(
  signedUrl: string,
  title = "Outfit League · AI preview",
) {
  if (Platform.OS === "web") {
    const response = await fetch(signedUrl);
    if (!response.ok)
      throw new Error("Couldn’t download this preview. Please refresh it.");
    const blob = await response.blob();
    const file = new File([blob], "outfit-league-AI-preview.jpg", {
      type: "image/jpeg",
    });
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({
        files: [file],
        title,
      });
    else {
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    return;
  }
  if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory)
    throw new Error("Sharing isn’t available on this device.");
  const path =
    FileSystem.cacheDirectory +
    "outfit-league-AI-preview-" +
    Date.now() +
    ".jpg";
  try {
    await FileSystem.downloadAsync(signedUrl, path);
    await Sharing.shareAsync(path, {
      mimeType: "image/jpeg",
      UTI: "public.jpeg",
      dialogTitle: title,
    });
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}
