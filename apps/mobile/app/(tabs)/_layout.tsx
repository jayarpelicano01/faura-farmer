import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="budgets" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="debts" />
      <Stack.Screen name="recurring" />
      <Stack.Screen name="more" />
    </Stack>
  );
}
