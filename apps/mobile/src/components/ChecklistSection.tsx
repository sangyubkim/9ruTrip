import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChecklistItem } from "../types";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  compact?: boolean;
};

/** 체크인 체크리스트 (예약번호·여권·WiFi·미팅포인트) */
export function ChecklistSection({ items, onToggle, compact }: Props) {
  const { colors } = useTheme();
  if (!items.length) return null;

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.bgElevated,
          borderColor: colors.border,
        },
        compact && styles.compact,
      ]}
      accessibilityRole="summary"
      accessibilityLabel="체크인 체크리스트"
    >
      <Text style={[styles.title, { color: colors.text }]}>
        체크인 체크리스트
      </Text>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.row}
          onPress={() => onToggle(item.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          accessibilityLabel={item.label}
        >
          <View
            style={[
              styles.boxCheck,
              {
                borderColor: colors.accent,
                backgroundColor: item.checked
                  ? colors.accent
                  : "transparent",
              },
            ]}
          >
            {item.checked ? (
              <Text style={[styles.checkMark, { color: colors.primaryFg }]}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.label,
              {
                color: item.checked ? colors.textMuted : colors.textSecondary,
                textDecorationLine: item.checked ? "line-through" : "none",
              },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  compact: { marginTop: 4 },
  title: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingVertical: 4,
  },
  boxCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "600", flex: 1 },
});
