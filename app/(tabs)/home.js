import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";
import { removeToken } from "../utils/auth";

export default function Home() {
  const router = useRouter();

  const handleLogout = async () => {
    await removeToken();
    router.replace("/ogin");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>Welcome to Home!</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}
