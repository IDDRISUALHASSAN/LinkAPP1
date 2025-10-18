import { Drawer } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true, // show top header
        headerStyle: { backgroundColor: "#05a31dff" },
        headerTintColor: "#fff",
        drawerActiveTintColor: "#05a31dff", // active icon & label color
        drawerLabelStyle: { fontSize: 15, fontWeight: "600" },
      }}
    >
      {/* Tabs (Home + Explore) */}
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: "Home",
          title: "Dashboard", // title shown in header
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Contacts */}
      <Drawer.Screen
        name="contacts"
        options={{
          drawerLabel: "Contacts",
          title: "Your Contacts",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Profile */}
      <Drawer.Screen
        name="profile"
        options={{
          drawerLabel: "Profile",
          title: "My Profile",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Settings */}
      <Drawer.Screen
        name="setting"
        options={{
          drawerLabel: "Settings",
          title: "App Settings",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

       <Drawer.Screen
        name="logout"
        options={{
          drawerLabel: "Logout",
          title: "Logout",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
