import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import type { LocalPhoto } from "../types/tryon";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
export async function disposePhoto(photo: LocalPhoto | null) {
  if (!photo) return;
  if (Platform.OS === "web") {
    if (photo.uri.startsWith("blob:")) URL.revokeObjectURL(photo.uri);
    return;
  }
  if (
    FileSystem.cacheDirectory &&
    photo.uri.startsWith(FileSystem.cacheDirectory)
  )
    await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(
      () => {},
    );
}

export async function pickPhoto(camera = false): Promise<LocalPhoto | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Camera access wasn’t granted. You can choose a photo instead.",
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const input = result.assets[0];
  return preparePhoto(input.uri, input.width, input.height);
}
export async function preparePhoto(
  uri: string,
  width?: number,
  height?: number,
): Promise<LocalPhoto> {
  // Shared native images may not include dimensions. Decode locally, never fetch social links.
  if (!width || !height) {
    const metadata = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uri = metadata.uri;
    width = metadata.width;
    height = metadata.height;
  }
  const input = { uri, width, height };
  if (input.width < 64 || input.height < 64)
    throw new Error("Please choose a larger, clearer photo.");
  // Full detail for 2K results; the 8 MB cap below still applies.
  const ratio = Math.min(1, 2400 / Math.max(input.width, input.height));
  const output = await ImageManipulator.manipulateAsync(
    input.uri,
    [
      {
        resize: {
          width: Math.round(input.width * ratio),
          height: Math.round(input.height * ratio),
        },
      },
    ],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9, base64: true },
  );
  if (!output.base64)
    throw new Error(
      "We couldn’t prepare that photo. Please try a different image.",
    );
  const bytes = decode(output.base64).byteLength;
  if (bytes > 8 * 1024 * 1024)
    throw new Error("That image is too large. Please choose one under 8 MB.");
  return {
    uri: output.uri,
    base64: output.base64,
    width: output.width,
    height: output.height,
    bytes,
  };
}

// Square, small JPEG for a profile photo (the avatars bucket caps at 1 MB).
export async function pickAvatar(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const input = result.canceled ? null : result.assets[0];
  if (!input) return null;
  const side = Math.min(input.width, input.height);
  const output = await ImageManipulator.manipulateAsync(
    input.uri,
    [
      {
        crop: {
          originX: (input.width - side) / 2,
          originY: (input.height - side) / 2,
          width: side,
          height: side,
        },
      },
      { resize: { width: 512, height: 512 } },
    ],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true },
  );
  if (!output.base64)
    throw new Error("We couldn’t prepare that photo. Please try another.");
  return output.base64;
}
