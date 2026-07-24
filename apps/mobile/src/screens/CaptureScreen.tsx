import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { EmptyState } from "../components/EmptyState";
import { FadeIn } from "../components/FadeIn";
import { InlineToast } from "../components/InlineToast";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";
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
  const [rating, setRating] = useState(5);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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
      rating,
    };
    onChangeTrip({
      ...trip,
      reviews: [...trip.reviews, review],
      updatedAt: new Date().toISOString(),
    });
    setCaption("");
    setImageUri(null);
    setSavedMsg("리뷰가 저장되었습니다");
    setTimeout(() => setSavedMsg(null), 2800);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FadeIn>
        <Pressable
          onPress={onBack}
          style={styles.backHit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="일정으로 돌아가기"
        >
          <Text style={[styles.back, { color: colors.accent }]}>← 일정</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          사진 · 리뷰
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          현장에서 남긴 기록이 After·WordPress 발행으로 이어집니다.
        </Text>
      </FadeIn>

      {savedMsg ? (
        <InlineToast message={savedMsg} tone="success" withFade />
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        장소
      </Text>
      <FlatList
        horizontal
        data={trip.places}
        keyExtractor={(p) => p.id}
        style={{ maxHeight: 52, marginVertical: space.sm }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const on = placeId === item.id;
          return (
            <Pressable
              style={[
                styles.chip,
                {
                  backgroundColor: on ? colors.chipOnBg : colors.chipBg,
                  borderColor: on ? colors.primary : colors.border,
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
            일정이 없습니다. Plan에서 장소를 추가하세요.
          </Text>
        }
      />

      <View style={styles.row}>
        <Pressable
          style={[
            styles.mediaBtn,
            {
              backgroundColor: colors.accentMuted,
              borderColor: colors.mapBorder,
            },
          ]}
          onPress={() => void pick(true)}
          accessibilityRole="button"
          accessibilityLabel="카메라"
        >
          <Text style={[styles.mediaBtnText, { color: colors.accent }]}>
            카메라
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.mediaBtn,
            {
              backgroundColor: colors.accentMuted,
              borderColor: colors.mapBorder,
            },
          ]}
          onPress={() => void pick(false)}
          accessibilityRole="button"
          accessibilityLabel="갤러리"
        >
          <Text style={[styles.mediaBtnText, { color: colors.accent }]}>
            갤러리
          </Text>
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
            minHeight: 80,
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

      <Text style={[styles.label, { color: colors.textSecondary }]}>별점</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = rating >= n;
          return (
            <Pressable
              key={n}
              style={[
                styles.star,
                {
                  backgroundColor: on ? colors.primary : colors.bgMuted,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setRating(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n}점`}
              accessibilityState={{ selected: rating === n }}
            >
              <Text
                style={[
                  styles.starText,
                  { color: on ? colors.primaryFg : colors.textMuted },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
        ListEmptyComponent={
          <EmptyState
            glyph="◎"
            title="아직 리뷰가 없습니다"
            body="사진이나 문구를 남기면 After 요약·WP 발행에 바로 쓸 수 있습니다."
          />
        }
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backHit: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  back: { fontWeight: "700", fontSize: 15 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  hint: { fontSize: 13, marginTop: space.xs, marginBottom: space.sm, lineHeight: 19 },
  label: { marginTop: space.md, fontWeight: "700", fontSize: 13 },
  input: {
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  mediaBtn: {
    flex: 1,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  mediaBtnText: { fontWeight: "800", fontSize: 15 },
  preview: {
    marginTop: space.md,
    width: "100%",
    height: 168,
    borderRadius: radius.md,
  },
  starRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
  },
  star: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  starText: { fontWeight: "800", fontSize: 16 },
  primary: {
    marginTop: space.lg,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800", fontSize: 16 },
  section: {
    marginTop: space.xl,
    marginBottom: space.sm,
    fontWeight: "800",
    fontSize: 16,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginRight: space.sm,
    maxWidth: 168,
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  card: {
    flexDirection: "row",
    gap: space.md,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  name: { fontWeight: "800" },
  meta: { marginTop: 2, fontSize: 13, lineHeight: 18 },
});
