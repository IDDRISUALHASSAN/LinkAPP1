import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function UserAvatar({
  uri,
  size = 40,
  style,
  showBorder = false,
}) {
  const source =
    uri && typeof uri === "string" && uri.startsWith("http")
      ? { uri }
      : require("../../assets/images/profile.png");

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: showBorder ? "#05a31dff" : "transparent",
          borderWidth: showBorder ? 2 : 0,
        },
        style,
      ]}
    >
      <Image source={source} style={[styles.avatar, { borderRadius: size / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    backgroundColor: "#ddd",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
});
