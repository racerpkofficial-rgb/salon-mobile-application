import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { RouteName, UserRole } from '../types';

type State = {
  route: RouteName;
  role: UserRole | null;
  history: RouteName[];
  navigate: (r: RouteName) => void;
  goBack: () => boolean;
  chooseRole: (r: UserRole) => void;
};

const C = createContext<State | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<RouteName[]>(['SPLASH']);
  const route = history[history.length - 1] || 'SPLASH';
  const [role, chooseRole] = useState<UserRole | null>(null);

  const navigate = (r: RouteName) => {
    setHistory((prev) => (prev[prev.length - 1] === r ? prev : [...prev, r]));
  };

  const goBack = (): boolean => {
    if (history.length > 1) {
      setHistory((prev) => prev.slice(0, prev.length - 1));
      return true;
    }
    return false;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return goBack();
    });
    return () => subscription.remove();
  }, [history]);

  return (
    <C.Provider value={{ route, role, history, navigate, goBack, chooseRole }}>
      {children}
    </C.Provider>
  );
}

export function useApp() {
  const v = useContext(C);
  if (!v) throw new Error('AppProvider required');
  return v;
}