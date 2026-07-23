import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { PlaceReview, Trip } from "../types";

type Props = {
  trip: Trip;
  onChangeTrip: (trip: Trip) => void;
  onBack: () => void;
};

export function CaptureScreen({ trip, onChangeTrip, onBack }: Props) {
  const [placeId, setPlaceId] = useState(trip.places[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [rating, setRating] = useState("5");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const selected = useMemo(
    () => trip.places.find((p) => p.id === placeId),
    [trip.places, placeId],
  );

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "카메라/갤러리 권한을 허용해 주세요.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          allowsEditing: true,
        });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const save = () => {
    if (!caption.trim() && !imageUri) {
      Alert.alert("입력 필요", "사진 또는 리뷰 문구를 추가해 주세요.");
      return;
    }
    const review: PlaceReview = {
      id: `rev-${Date.now()}`,
      imageUri,
      caption: caption.trim(),
      order: trip.reviews.length,
      placeId: selected?.id,
      placeName: selected?.name,
      rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
    };
    onChangeTrip({
      ...trip,
      reviews: [...trip.reviews, review],
      updatedAt: new Date().toISOString(),
    });
    setCaption("");
    setImageUri(null);
    Alert.alert("저장됨", "리뷰가 여행에 추가되었습니다.");
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 일정</Text>
      </Pressable>
      <Text style={styles.title}>사진 · 리뷰 캡처</Text>
      <Text style={styles.hint}>9ruDocs Step 모델과 호환 (발행 시 BlogDraft로 변환)</Text>

      <Text style={styles.label}>장소 선택</Text>
      <FlatList
        horizontal
        data={trip.places}
        keyExtractor={(p) => p.id}
        style={{ maxHeight: 48, marginVertical: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, placeId === item.id && styles.chipOn]}
            onPress={() => setPlaceId(item.id)}
          >
            <Text
              style={[styles.chipText, placeId === item.id && styles.chipTextOn]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.hint}>일정이 없습니다.</Text>}
      />

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void pick(true)}>
          <Text style={styles.btnText}>카메라</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void pick(false)}>
          <Text style={styles.btnText}>갤러리</Text>
        </Pressable>
      </View>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : null}

      <Text style={styles.label}>리뷰</Text>
      <TextInput
        style={[styles.input, { minHeight: 72 }]}
        multiline
        value={caption}
        onChangeText={setCaption}
        placeholder="맛·분위기·팁 등"
      />

      <Text style={styles.label}>별점 (1~5)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={rating}
        onChangeText={setRating}
      />

      <Pressable style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>리뷰 저장</Text>
      </Pressable>

      <Text style={styles.section}>저장된 리뷰 ({trip.reviews.length})</Text>
      <FlatList
        data={[...trip.reviews].sort((a, b) => a.order - b.order)}
        keyExtractor={(r) => r.id}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumb} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.placeName || "장소 미지정"}</Text>
              <Text style={styles.meta}>
                {item.caption || "(문구 없음)"}
                {item.rating ? ` · ★${item.rating}` : ""}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { color: "#0369a1", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  hint: { color: "#64748b", fontSize: 12, marginBottom: 4 },
  label: { marginTop: 10, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#075985", fontWeight: "700" },
  preview: { marginTop: 10, width: "100%", height: 160, borderRadius: 10 },
  primary: {
    marginTop: 14,
    backgroundColor: "#0369a1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  section: { marginTop: 16, marginBottom: 8, fontWeight: "700" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    marginRight: 6,
    maxWidth: 160,
  },
  chipOn: { backgroundColor: "#0369a1" },
  chipText: { color: "#334155", fontSize: 12 },
  chipTextOn: { color: "#fff" },
  card: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  name: { fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, color: "#64748b", fontSize: 13 },
});
