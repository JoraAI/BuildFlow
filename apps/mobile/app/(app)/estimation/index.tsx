import { Redirect } from 'expo-router';

/** Legacy route - Estimation tab is now Proposals. */
export default function EstimationIndexRedirect() {
  return <Redirect href="/proposals" />;
}
