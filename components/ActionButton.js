import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from "react-native";

export default function ActionButton({
  icon: Icon,
  label,
  count,
  onPress,
  active = false,
  iconProps = {},
  style,
}) {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        {Icon && <Icon size={iconProps.size || 32} color={iconProps.color || (active ? "#ff3b30" : "#fff")} />}
      </View>
      {label !== undefined && <Text style={styles.label}>{label}</Text>}
      {count !== undefined && (
        <Text style={[styles.count, active && styles.countActive]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    color: "#fff",
    marginTop: 2,
  },
  count: {
    fontSize: 12,
    color: "#fff",
    marginTop: 2,
    fontWeight: "600",
  },
  countActive: {
    color: "#ff3b30",
  },
});
