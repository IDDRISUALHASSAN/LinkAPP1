import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const IP = "10.24.105.51:3000";
  const router = useRouter();

  const getContacts = async () => {
    try {
      const response = await fetch(`http://${IP}/users`);
      const data = await response.json();

      if (data.success) {
        setContacts(data.users);
      }
    } catch (error) {
      console.error("❌ Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getContacts();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Contacts</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#05a31dff" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {contacts.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              // ✅ Pass params the expo-router way
              onPress={() =>
                router.push({
                  pathname: "/chat",
                  params: {
                    receiverId: contact.PhoneNumber,
                    receiverName: contact.name,
                  },
                })
              }
            >
              <Text style={styles.name}>{contact.name}</Text>
              <Text style={styles.phone}>{contact.PhoneNumber}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40, backgroundColor: "#fff" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 15 },
  card: {
    backgroundColor: "#f2f2f2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "bold" },
  phone: { fontSize: 16, color: "gray" },
});
