import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = { children: React.ReactNode };

type State = { error: string | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>화면 오류</Text>
          <Text style={styles.msg}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", color: "#b91c1c" },
  msg: { marginTop: 8, color: "#334155" },
});
