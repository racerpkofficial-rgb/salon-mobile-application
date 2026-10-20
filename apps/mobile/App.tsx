import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { DialogProvider } from './src/context/DialogContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <DialogProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </DialogProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}