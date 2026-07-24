import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FocusEvent,
} from "react-native";
import { searchPlaces, type PlaceSearchResult } from "../api/trip";
import type { PlaceRef } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { radius, space } from "../theme/tokens";

type Props = {
  label: string;
  value: PlaceRef | null;
  onChange: (place: PlaceRef | null) => void;
  /** 검색 편향용 여행 도시 */
  biasCityId?: string;
  placeholder?: string;
  /** 부모 ScrollView가 포커스 필드를 키보드 위로 올릴 때 사용 */
  onInputFocus?: (e: FocusEvent) => void;
};

export function PlaceSearchField({
  label,
  value,
  onChange,
  biasCityId,
  placeholder = "지명·주소 검색",
  onInputFocus,
}: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const runSearch = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      const id = ++seq.current;
      setLoading(true);
      void searchPlaces({ query: text.trim(), cityId: biasCityId })
        .then((res) => {
          if (id !== seq.current) return;
          setResults(res.results);
          setOpen(res.results.length > 0);
        })
        .catch(() => {
          if (id !== seq.current) return;
          setResults([]);
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, 350);
  };

  const pick = (r: PlaceSearchResult) => {
    onChange({
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      placeId: r.placeId,
      query: r.name,
    });
    setQuery(r.name);
    setOpen(false);
    setResults([]);
  };

  const onBlurCommit = () => {
    // 검색 결과 없이 직접 입력한 경우도 허용
    const t = query.trim();
    if (!t) {
      onChange(null);
      return;
    }
    if (!value || value.name !== t) {
      onChange({
        name: t,
        address: value?.address,
        lat: value?.lat,
        lng: value?.lng,
        placeId: value?.placeId,
        query: t,
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: colors.border,
            backgroundColor: colors.bgElevated,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onChangeText={(t) => {
            setQuery(t);
            runSearch(t);
          }}
          onFocus={(e) => {
            if (results.length) setOpen(true);
            onInputFocus?.(e);
          }}
          onBlur={() => {
            // 결과 탭이 blur보다 늦게 오므로 약간 지연
            setTimeout(() => {
              setOpen(false);
              onBlurCommit();
            }, 180);
          }}
          accessibilityLabel={label}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : value ? (
          <Pressable
            onPress={() => {
              setQuery("");
              onChange(null);
              setResults([]);
            }}
            hitSlop={8}
            accessibilityLabel={`${label} 지우기`}
          >
            <Text style={{ color: colors.textMuted, fontWeight: "700" }}>
              지우기
            </Text>
          </Pressable>
        ) : null}
      </View>
      {value?.address ? (
        <Text style={[styles.addr, { color: colors.textMuted }]} numberOfLines={2}>
          {value.address}
        </Text>
      ) : null}
      {open && results.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {results.map((r, i) => (
            <Pressable
              key={`${r.placeId || r.name}-${i}`}
              style={[
                styles.row,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
              onPress={() => pick(r)}
              accessibilityRole="button"
              accessibilityLabel={`${r.name} 선택`}
            >
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {r.name}
              </Text>
              {r.address ? (
                <Text
                  style={[styles.rowSub, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {r.address}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md, zIndex: 2 },
  label: { fontWeight: "700", fontSize: 13, marginBottom: space.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
    gap: space.sm,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: space.md },
  addr: { marginTop: space.xs, fontSize: 12, lineHeight: 16 },
  dropdown: {
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: { paddingHorizontal: space.md, paddingVertical: space.md },
  rowTitle: { fontWeight: "700", fontSize: 14 },
  rowSub: { marginTop: 2, fontSize: 12 },
});
