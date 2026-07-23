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
import { FadeIn } from "../components/FadeIn";
import { useTheme } from "../theme/ThemeContext";
import type { PlaceReview, Trip } from "../types";

type Props = {
  trip: Trip;
  onChangeTrip: (trip: Trip) => void;
  onBack: () => void;
};

export function CaptureScreen({ trip, onChangeTrip, onBack }: Props) {
  const { colors } = useTheme();
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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <FadeIn>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="일정으로 돌아가기"
        >
          <Text style={[styles.back, { color: colors.accent }]}>← 일정</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          사진 · 리뷰 캡처
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          9ruDocs Step 모델과 호환 (발행 시 BlogDraft로 변환)
        </Text>
      </FadeIn>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        장소 선택
      </Text>
      <FlatList
        horizontal
        data={trip.places}
        keyExtractor={(p) => p.id}
        style={{ maxHeight: 48, marginVertical: 8 }}
        renderItem={({ item }) => {
          const on = placeId === item.id;
          return (
            <Pressable
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                },
              ]}
              onPress={() => setPlaceId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`장소 ${item.name}`}
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: on ? colors.chipOnFg : colors.chipFg },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            일정이 없습니다.
          </Text>
        }
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.accentMuted }]}
          onPress={() => void pick(true)}
          accessibilityRole="button"
          accessibilityLabel="카메라"
        >
          <Text style={[styles.btnText, { color: colors.accent }]}>카메라</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.accentMuted }]}
          onPress={() => void pick(false)}
          accessibilityRole="button"
          accessibilityLabel="갤러리"
        >
          <Text style={[styles.btnText, { color: colors.accent }]}>갤러리</Text>
        </Pressable>
      </View>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>리뷰</Text>
      <TextInput
        style={[
          styles.input,
          {
            minHeight: 72,
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        multiline
        value={caption}
        onChangeText={setCaption}
        placeholder="맛·분위기·팁 등"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="리뷰 문구"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        별점 (1~5)
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        keyboardType="number-pad"
        value={rating}
        onChangeText={setRating}
        accessibilityLabel="별점"
      />

      <Pressable
        style={[styles.primary, { backgroundColor: colors.primary }]}
        onPress={save}
        accessibilityRole="button"
        accessibilityLabel="리뷰 저장"
      >
        <Text style={[styles.primaryText, { color: colors.primaryFg }]}>
          리뷰 저장
        </Text>
      </Pressable>

      <Text style={[styles.section, { color: colors.text }]}>
        저장된 리뷰 ({trip.reviews.length})
      </Text>
      <FlatList
        data={[...trip.reviews].sort((a, b) => a.order - b.order)}
        keyExtractor={(r) => r.id}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
              },
            ]}
          >
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumb} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>
                {item.placeName || "장소 미지정"}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
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
  back: { marginBottom: 6, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "800" },
  hint: { fontSize: 12, marginBottom: 4 },
  label: { marginTop: 10, fontWeight: "600" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "700" },
  preview: { marginTop: 10, width: "100%", height: 160, borderRadius: 10 },
  primary: {
    marginTop: 14,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "700" },
  section: { marginTop: 16, marginBottom: 8, fontWeight: "700" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 6,
    maxWidth: 160,
    minHeight: 40,
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  card: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  name: { fontWeight: "700" },
  meta: { marginTop: 2, fontSize: 13 },
});
