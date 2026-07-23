import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useReduceMotion } from "../hooks/useReduceMotion";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** ms */
  duration?: number;
  delay?: number;
  /** 값이 바뀌면 페이드 재실행 */
  trigger?: string | number | boolean;
};

/** 섹션/배너 등장용 페이드 — reduce-motion 시 즉시 표시 */
export function FadeIn({
  children,
  style,
  duration = 220,
  delay = 0,
  trigger = 1,
}: Props) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduce ? 0 : 6)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trigger, reduce, duration, delay, opacity, translateY]);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }] }]}
      accessibilityElementsHidden={false}
    >
      {children}
    </Animated.View>
  );
}
