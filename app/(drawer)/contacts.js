import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import * as ContactsAPI from "expo-contacts";
import * as Localization from "expo-localization";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
const API_URL = Constants.expoConfig.extra.API_URL;

  const getContacts = async () => {
    try {
      setLoading(true);

      const { status } = await ContactsAPI.requestPermissionsAsync();
      if (status !== "granted") {
        alert("Permission to access contacts is required!");
        return;
      }

      const { data } = await ContactsAPI.getContactsAsync({
        fields: [ContactsAPI.Fields.PhoneNumbers],
      });

      if (data.length === 0) {
        alert("No contacts found on device!");
        return;
      }

      const countryCode = Localization.region || "GH"; // fallback to Ghana 🇬🇭

      // ✅ Normalize phone numbers
   const phoneNumbers = data
  .flatMap((c) =>
    c.phoneNumbers?.map((p) => {
      let raw = p.number.replace(/\s+/g, "").replace(/[^0-9+]/g, ""); // keep digits and +
      if (!raw) return null;

      try {
        const parsed = parsePhoneNumberFromString(raw, countryCode);
        if (parsed && parsed.isValid()) {
          return parsed.number;
        } else if (raw.startsWith("0") && raw.length >= 9 && countryCode === "GH") {
          return "+233" + raw.substring(1);
        }
        return null;
      } catch {
        return null;
      }
    }) || []
  )
  .filter((num) => num && num.length >= 10 && num.startsWith("+"));



      //  Send to backend
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumbers, countryCode }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      console.log("Backend response:", result);

      if (result.success) {
        setContacts(result.users);
      } else {
        alert(result.message || "No registered contacts found");
        setContacts([]);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
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
      return require("../../assets/images/profile.png");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contacts Using LinkApp</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#05a31dff" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>No registered contacts found.</Text>
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
                <Image source={getProfileImage(contact)} style={styles.avatar} />
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
