import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { radius, space } from "../theme/tokens";

type Colors = {
  text: string;
  textMuted: string;
  border: string;
  bgElevated: string;
  chipBg: string;
  primary: string;
  primaryFg: string;
};

type Props = {
  startDate?: string;
  endDate?: string;
  onChange: (startDate: string, endDate?: string) => void;
  colors: Colors;
  disabled?: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

export function DateRangeCalendar({
  startDate,
  endDate,
  onChange,
  colors,
  disabled = false,
}: Props) {
  const initial = startDate ? parseIsoDate(startDate) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? undefined : index - firstWeekday + 1,
  );

  const selectDate = (date: string) => {
    if (!startDate || endDate) {
      onChange(date);
      return;
    }
    if (date < startDate) {
      onChange(date);
      return;
    }
    onChange(startDate, date);
  };

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border, backgroundColor: colors.bgElevated },
            disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.monthHeader}>
        <Pressable
          style={[styles.monthButton, { backgroundColor: colors.chipBg }]}
          onPress={() => setVisibleMonth(new Date(year, month - 1, 1))}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
        >
          <Text style={[styles.monthButtonText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {monthLabel(year, month)}
        </Text>
        <Pressable
          style={[styles.monthButton, { backgroundColor: colors.chipBg }]}
          onPress={() => setVisibleMonth(new Date(year, month + 1, 1))}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
        >
          <Text style={[styles.monthButtonText, { color: colors.text }]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((weekday) => (
          <Text
            key={weekday}
            style={[styles.weekday, { color: colors.textMuted }]}
          >
            {weekday}
          </Text>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.day} />;
          const date = toIsoDate(year, month, day);
          const isBoundary = date === startDate || date === endDate;
          const isInRange =
            Boolean(startDate && endDate) && date > startDate! && date < endDate!;
          return (
            <Pressable
              key={date}
              style={[
                styles.day,
                isInRange && { backgroundColor: colors.chipBg },
                isBoundary && { backgroundColor: colors.primary },
              ]}
              onPress={() => selectDate(date)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${month + 1}월 ${day}일${isBoundary ? " 선택됨" : ""}`}
              accessibilityState={{ selected: isBoundary, disabled }}
            >
              <Text
                style={[
                  styles.dayText,
                  { color: isBoundary ? colors.primaryFg : colors.text },
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: space.sm,
    padding: space.sm,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  monthButton: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  monthButtonText: { fontSize: 28, lineHeight: 30, fontWeight: "500" },
  monthTitle: { fontSize: 16, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: "14.2857%", textAlign: "center", fontSize: 12, marginBottom: 4 },
  day: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  dayText: { fontSize: 14, fontWeight: "700" },
});
