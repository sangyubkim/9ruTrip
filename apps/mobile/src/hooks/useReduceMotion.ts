import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** 시스템 「동작 줄이기」 여부 — 애니메이션 생략용 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduce(!!v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduce(!!v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
