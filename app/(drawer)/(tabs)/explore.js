import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

export default function Home() {
  return (
    <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'white'}}>
      <Text style={styles.heard}>This is your your explore</Text>
    </View>
  )
}

const styles = StyleSheet.create({
    heard:{fontSize:20, 
        fontWeight:'600' 
        ,color:'black',
        textAlign:'center',
        margin:20,
        padding:10,
        borderWidth:1,
        
    }  
})