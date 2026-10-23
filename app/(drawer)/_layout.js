import { Drawer } from "expo-router/drawer";
import {
  Home,
  Users,
  User,
  Settings,
  LogOut,
  Bell,
} from "lucide-react-native";
import HeaderBell from "@/components/HeaderBell";

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#05a31dff" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
        headerRight: () => <HeaderBell />,
        drawerActiveTintColor: "#05a31dff",
        drawerLabelStyle: { fontSize: 15, fontWeight: "600" },
        drawerInactiveTintColor: "#555",
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: "Home",
          title: "Dashboard",
          drawerIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="contacts"
        options={{
          drawerLabel: "Contacts",
          title: "Your Contacts",
          drawerIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="profile"
        options={{
          drawerLabel: "Profile",
          title: "My Profile",
          drawerIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="notifications"
        options={{
          drawerLabel: "Notifications",
          title: "Notifications",
          drawerIcon: ({ color, size }) => (
            <Bell size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="setting"
        options={{
          drawerLabel: "Settings",
          title: "App Settings",
          drawerIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="logout"
        options={{
          drawerLabel: "Logout",
          title: "Logout",
          drawerIcon: ({ color, size }) => (
            <LogOut size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
