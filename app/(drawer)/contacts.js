import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const IP = "10.223.221.51:3000";
  const router = useRouter();

  const getContacts = async () => {
    try {
      const response = await fetch(`http://${IP}/users`);
      const data = await response.json();

      if (data.success) {
        setContacts(data.users);
      }
    } catch (error) {
      console.error(" Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getContacts();
  }, []);

  const getProfileImage = (contact) => {
    
    if (
      contact.profilePic &&
      typeof contact.profilePic === "string" &&
      contact.profilePic.startsWith("http")
    ) {
      return { uri: contact.profilePic };
    } else {
      return require("../../assets/images/avatar.png"); 
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Contacts</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#05a31dff"
          style={{ marginTop: 20 }}
        />
      ) : (
        <ScrollView style={styles.scroll}>
          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>No contacts found.</Text>
          ) : (
            contacts.map((contact, index) => (
              <TouchableOpacity
                key={index}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "../chatfiles/chat",
                    params: {
                      receiverId: contact.PhoneNumber,
                      receiverName: contact.name,
                      profilePic: contact.profilePic,
                    },
                  })
                }
              >
                {/* ✅ Profile Picture (shows only if valid URL) */}
                <Image source={getProfileImage(contact)} style={styles.avatar} />

                {/* Name + Phone */}
                <View style={styles.info}>
                  <Text style={styles.name}>{contact.name}</Text>
                  <Text style={styles.phone}>{contact.PhoneNumber}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: "#ddd",
  },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: "600", color: "#222" },
  phone: { fontSize: 14, color: "gray", marginTop: 3 },
  emptyText: {
    textAlign: "center",
    color: "gray",
    marginTop: 30,
    fontSize: 16,
  },
});
